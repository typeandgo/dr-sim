import { SCRIPT_IDS } from '@/core/constants';
import { toMatchPattern, toOriginPattern } from '@/core/matcher';
import type { DomainScope } from '@/core/types';

// Dinamik scope ve izin yönetimi — 01-architecture.md §2.2 / §6.
// Statik host izni yoktur; domain eklendikçe izin istenir ve content script kaydı güncellenir.

const MAIN_SCRIPT = {
  id: SCRIPT_IDS.MAIN,
  js: ['content/interceptor.main.js'],
  world: 'MAIN' as const,
  runAt: 'document_start' as const,
  allFrames: true,
  persistAcrossSessions: true,
};

const BRIDGE_SCRIPT = {
  id: SCRIPT_IDS.BRIDGE,
  js: ['content/bridge.content.js'],
  world: 'ISOLATED' as const,
  runAt: 'document_start' as const,
  allFrames: true,
  persistAcrossSessions: true,
};

// Enjeksiyon kapsamı = yönetilen domainler ∪ açıkça izin verilen sayfa host'ları.
// Uygulama ile API farklı host'taysa yalnızca domain listesi yetmez.
export const matchPatternsFor = (domains: DomainScope[], pageHosts: DomainScope[] = []): string[] => {
  const patterns = [...domains, ...pageHosts]
    .filter((domain) => domain.granted !== false)
    .map((domain) => toMatchPattern(domain.pattern))
    .filter((pattern): pattern is string => pattern !== null);

  return [...new Set(patterns)];
};

// DİKKAT: burada `chrome.permissions.request()` ÇAĞRILMAZ. O API yalnızca kullanıcı
// hareketi bağlamında çalışır; service worker'da gesture olmadığı için çağrı fırlatır
// ve izin dialogu hiç açılmaz. İstek UI'dan yapılır (`src/ui/permissions.ts`),
// SW yalnızca sonucu `contains()` ile doğrular.
export const hasDomainPermission = async (pattern: string): Promise<boolean> => {
  const origin = toOriginPattern(pattern);
  if (!origin) return false;

  try {
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
};

// Verilmiş TÜM host izinlerini bırakır (hard reset); bırakılAMAYANları döner.
//
// Manifest'te statik host izni yoktur, dolayısıyla `getAll().origins` yalnızca
// kullanıcının çalışma anında verdiklerini içerir — zorunlu izinler etkilenmez.
//
// Origin'ler TEK TEK kaldırılır. `chrome.permissions.remove()` hepsi-ya-hiç
// çalışır: listedeki tek bir kaldırılamaz origin, diğerlerinin de kalmasına yol
// açardı. Sonuç sessizce yutulmaz — geriye kalan izin, kullanıcının sıfırladığını
// sanıp izin penceresinin bir daha hiç açılmamasına sebep olur (Chrome zaten
// izinli olduğu için dialog göstermez).
export const releaseAllPermissions = async (): Promise<string[]> => {
  let origins: string[] = [];

  try {
    const granted = await chrome.permissions.getAll();
    origins = granted.origins ?? [];
  } catch {
    return [];
  }

  if (!origins.length) return [];

  const remaining: string[] = [];

  await Promise.all(origins.map(async (origin) => {
    try {
      // `remove()` false döndürebilir: kaldırılamadı demektir, hata fırlatmaz
      if (!await chrome.permissions.remove({ origins: [origin] })) remaining.push(origin);
    } catch {
      remaining.push(origin);
    }
  }));

  return remaining;
};

// Bir domain silinirken, aynı origin başka bir domain tarafından kullanılmıyorsa izni kaldır
export const releaseDomainPermission = async (pattern: string, remaining: DomainScope[]): Promise<void> => {
  const origin = toOriginPattern(pattern);
  if (!origin) return;
  if (remaining.some((domain) => toOriginPattern(domain.pattern) === origin)) return;

  try {
    await chrome.permissions.remove({ origins: [origin] });
  } catch {
    // izin kaldırılamazsa kayıt yine de güncellenir
  }
};

// Son BAŞARIYLA uygulanan enjeksiyon kapsamı. `applyRuntimeSideEffects` her
// başarılı komuttan sonra koştuğu için (log temizleme, dil değişimi, satır
// toggle'ı…) bu koruma olmadan her tıklama bir `chrome.scripting` turu üretiyordu.
// Yalnızca başarıda yazılır: kayıt başarısızsa bir sonraki çağrı tekrar denemeli.
let appliedSignature: string | null = null;

export const resetScopeSyncCache = (): void => {
  appliedSignature = null;
};

// MAIN + ISOLATED çiftini tek kopya olacak şekilde senkronlar (Chrome restart sonrası duplicate önlenir)
export const syncContentScripts = async (
  domains: DomainScope[],
  pageHosts: DomainScope[] = [],
): Promise<void> => {
  const matches = matchPatternsFor(domains, pageHosts);

  const signature = [...matches].sort().join('|');
  if (signature === appliedSignature) return;

  let registered: chrome.scripting.RegisteredContentScript[] = [];
  try {
    registered = await chrome.scripting.getRegisteredContentScripts({
      ids: [SCRIPT_IDS.MAIN, SCRIPT_IDS.BRIDGE],
    });
  } catch {
    registered = [];
  }

  if (!matches.length) {
    if (!registered.length) {
      appliedSignature = signature;
      return;
    }
    try {
      await chrome.scripting.unregisterContentScripts({ ids: registered.map((script) => script.id) });
      // İmza yalnızca kaldırma BAŞARILIYSA yazılır; yoksa bir sonraki çağrı
      // "zaten uygulandı" deyip atlar ve script'ler kayıtlı kalırdı
      appliedSignature = signature;
    } catch {
      appliedSignature = null;
    }
    return;
  }

  const scripts = [{ ...MAIN_SCRIPT, matches }, { ...BRIDGE_SCRIPT, matches }];
  const existing = new Set(registered.map((script) => script.id));

  const toUpdate = scripts.filter((script) => existing.has(script.id));
  const toRegister = scripts.filter((script) => !existing.has(script.id));

  try {
    if (toUpdate.length) await chrome.scripting.updateContentScripts(toUpdate);
    if (toRegister.length) await chrome.scripting.registerContentScripts(toRegister);
    appliedSignature = signature;
  } catch {
    // Chrome bazı durumlarda "duplicate id" döner → tümünü kaldırıp yeniden kaydet
    try {
      await chrome.scripting.unregisterContentScripts({ ids: scripts.map((script) => script.id) });
      await chrome.scripting.registerContentScripts(scripts);
      appliedSignature = signature;
    } catch {
      // yine başarısızsa enjeksiyon yapılmaz; UI domain'i "izin bekliyor" gösterir
      appliedSignature = null;
    }
  }
};
