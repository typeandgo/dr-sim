import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS, STORAGE_KEYS } from '@/core/constants';
import { installChromeMock, type ChromeMock } from '@/test/chrome-mock';
import type { buildState as BuildState, runCommand as RunCommand } from './service-worker';
import type { sessionStore as SessionStore } from './stores/session.store';
import type { settingsStore as SettingsStore } from './stores/settings.store';

// Service worker komut yüzeyi — 546 satırın tamamı buradan geçiyor ve dosyanın
// sonundaki `export { buildState, runCommand }` tam bu test için açılmıştı.
//
// `runCommand` sözleşmesi: HİÇBİR girdi handler'ı fırlatmamalı; her sonuç
// `{ ok, error? }` olmalı. Aşağıdaki testler geçerli yolun yanında bozuk
// payload'ları da sürüyor.

let chromeMock: ChromeMock;
let runCommand: typeof RunCommand;
let buildState: typeof BuildState;
let settingsStore: typeof SettingsStore;
let sessionStore: typeof SessionStore;

const run = (command: string, payload: Record<string, unknown> = {}, tabId: number | null = null) => runCommand(command, { tabId, payload });

beforeEach(async () => {
  vi.resetModules();
  chromeMock = installChromeMock();

  const module = await import('./service-worker');
  runCommand = module.runCommand;
  buildState = module.buildState;
  ({ settingsStore } = await import('./stores/settings.store'));
  ({ sessionStore } = await import('./stores/session.store'));

  // bootstrap top-level'da tetikleniyor; store'un yüklenmesini bekle
  await run(COMMANDS.DISMISS_NOTICE);
});

// Depo yazmaları debounce'lu ve zamanlayıcılar MODÜL seviyesinde tutuluyor;
// `vi.resetModules()` onları iptal etmez. İptal edilmezlerse test bittikten
// sonra tetiklenip bir SONRAKİ testin chrome mock'una yazıyor ve o testi
// alakasız bir sebeple düşürüyorlar (bu gerçekten yaşandı: sızan `locale: 'tr'`
// yüzünden dosya adı `dr-sim-profil-` çıkıp profil testi kırıldı).
afterEach(async () => {
  await settingsStore.flush();
  await sessionStore.clear();
  vi.clearAllMocks();
});

describe('background/service-worker — komut yüzeyi', () => {
  it('bilinmeyen komut çökmez, hata kodu döner', async () => {
    expect(await run('NOPE')).toEqual({ ok: false, error: 'unknown-command' });
  });

  describe('SET_ENABLED', () => {
    it('simülasyonu açar ve kapatır', async () => {
      expect(await run(COMMANDS.SET_ENABLED, { enabled: true })).toEqual({ ok: true });
      expect(buildState(null).settings.enabled).toBe(true);

      expect(await run(COMMANDS.SET_ENABLED, { enabled: false })).toEqual({ ok: true });
      expect(buildState(null).settings.enabled).toBe(false);
    });

    it('production guard eşleşen domainde açmayı durdurur', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.acme.com' });

      const result = await run(COMMANDS.SET_ENABLED, { enabled: true });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('production-guard');
      expect((result.data as { domains: string[] }).domains).toContain('api.acme.com');
      expect(buildState(null).settings.enabled).toBe(false);
    });

    it('onay verilince production domainde de açılır', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.acme.com' });

      expect(await run(COMMANDS.SET_ENABLED, { enabled: true, confirmProduction: true })).toEqual({ ok: true });
      expect(buildState(null).settings.enabled).toBe(true);
    });
  });

  describe('domain yönetimi', () => {
    it('domain ekler ve izin durumunu doğrular', async () => {
      expect(await run(COMMANDS.ADD_DOMAIN, { pattern: 'https://api.example.com/' })).toEqual({ ok: true });

      const [domain] = buildState(null).settings.domains;
      expect(domain?.pattern).toBe('api.example.com');
      expect(domain?.granted).toBe(true);
    });

    it('aynı domain ikinci kez eklenemez — çevrilebilir KOD döner, hazır metin değil', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });

      const result = await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });

      expect(result).toEqual({ ok: false, error: 'domain-duplicate' });
    });

    it('geçersiz domain reddedilir', async () => {
      expect(await run(COMMANDS.ADD_DOMAIN, { pattern: 'a b' })).toEqual({ ok: false, error: 'domain-invalid' });
      expect(await run(COMMANDS.ADD_DOMAIN, {})).toEqual({ ok: false, error: 'domain-empty' });
    });

    it('domain silinince izin de bırakılır', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });
      const { id } = buildState(null).settings.domains[0]!;

      expect(await run(COMMANDS.REMOVE_DOMAIN, { id })).toEqual({ ok: true });
      expect(buildState(null).settings.domains).toHaveLength(0);
      expect(chromeMock.permissions.remove).toHaveBeenCalledWith({ origins: ['*://api.example.com/*'] });
    });

    it('olmayan domain silinemez', async () => {
      expect(await run(COMMANDS.REMOVE_DOMAIN, { id: 'yok' })).toEqual({ ok: false, error: 'not-found' });
    });

    // İzin chrome://extensions'dan geri alınabilir. Eskiden `granted` yalnızca
    // ekleme anında hesaplanıp bir daha doğrulanmıyordu: kayıt sonsuza kadar
    // `true` kalıyor, panel uyarmıyor, eklenti sessizce enjekte etmeyi bırakıyordu.
    it('geri alınan izin bir sonraki uyanışta yakalanır', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });
      expect(buildState(null).settings.domains[0]?.granted).toBe(true);

      // Kullanıcı chrome://extensions'dan erişimi geri aldı
      chromeMock.permissions.contains.mockResolvedValue(false);
      chromeMock.permissions.onRemoved.emit();

      await vi.waitFor(() => {
        expect(buildState(null).settings.domains[0]?.granted).toBe(false);
      });
    });

    it('izin geri verilince durum kendiliğinden düzelir', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });

      chromeMock.permissions.contains.mockResolvedValue(false);
      chromeMock.permissions.onRemoved.emit();
      await vi.waitFor(() => {
        expect(buildState(null).settings.domains[0]?.granted).toBe(false);
      });

      chromeMock.permissions.contains.mockResolvedValue(true);
      chromeMock.permissions.onAdded.emit();
      await vi.waitFor(() => {
        expect(buildState(null).settings.domains[0]?.granted).toBe(true);
      });
    });

    it('izinli kalan domainde gereksiz yazma yapılmaz', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });
      const before = buildState(null).revision;

      chromeMock.permissions.onRemoved.emit();
      await vi.waitFor(() => {
        expect(chromeMock.permissions.contains).toHaveBeenCalled();
      });

      expect(buildState(null).revision).toBe(before);
    });

    it('izin verilmemiş sayfa host’u eklenmez', async () => {
      chromeMock.permissions.contains.mockResolvedValueOnce(false);

      expect(await run(COMMANDS.ADD_PAGE_HOST, { pattern: 'panel.example.com' }))
        .toEqual({ ok: false, error: 'permission-denied' });
    });
  });

  describe('kurallar', () => {
    it('toggle varsayılan politikanın tersini yazar', async () => {
      expect(await run(COMMANDS.TOGGLE_RULE_STATE, { path: '/orders' })).toEqual({ ok: true });

      // Varsayılan politika 'block' → ilk toggle 'allow' üretir
      expect(buildState(null).settings.rules[0]).toMatchObject({ path: '/orders', state: 'allow' });

      await run(COMMANDS.TOGGLE_RULE_STATE, { path: '/orders' });
      expect(buildState(null).settings.rules[0]?.state).toBe('block');
    });

    it('geçersiz path kural yazmaz', async () => {
      expect(await run(COMMANDS.SET_RULE_STATE, { path: '/*', state: 'block' }))
        .toEqual({ ok: false, error: 'path-wildcard' });
      expect(await run(COMMANDS.TOGGLE_RULE_STATE, { path: '' }))
        .toEqual({ ok: false, error: 'path-empty' });
    });

    it('toggle method’suz çalışır ve tek kayıt üretir', async () => {
      await run(COMMANDS.TOGGLE_RULE_STATE, { path: '/orders' });

      expect(buildState(null).settings.rules).toEqual([
        { path: '/orders', state: 'allow', createdAt: expect.any(Number) },
      ]);
    });

    it('SET_RULE_STATE path’i normalize eder', async () => {
      expect(await run(COMMANDS.SET_RULE_STATE, { path: '/orders/8842/detail', state: 'allow' }))
        .toEqual({ ok: true });

      expect(buildState(null).settings.rules[0]).toMatchObject({
        path: '/orders/:id/detail',
        state: 'allow',
      });
    });

    it('joker ve boş path reddedilir', async () => {
      expect(await run(COMMANDS.SET_RULE_STATE, { path: '/a/*' })).toEqual({ ok: false, error: 'path-wildcard' });
      expect(await run(COMMANDS.SET_RULE_STATE, { path: '' })).toEqual({ ok: false, error: 'path-empty' });
    });

    it('kural silinir ve liste sıfırlanır', async () => {
      await run(COMMANDS.SET_RULE_STATE, { path: '/a', state: 'allow' });
      await run(COMMANDS.SET_RULE_STATE, { path: '/b', state: 'block' });

      await run(COMMANDS.REMOVE_RULE, { path: '/a' });
      expect(buildState(null).settings.rules.map((rule) => rule.path)).toEqual(['/b']);

      await run(COMMANDS.CLEAR_RULES);
      expect(buildState(null).settings.rules).toHaveLength(0);
    });
  });

  describe('profiller', () => {
    const profileJson = JSON.stringify({
      name: 'DR — ödeme',
      defaultPolicy: 'pass',
      rules: [{ path: '/a', state: 'allow', createdAt: 0 }],
    });

    it('profil içe aktarılır ve uygulanır', async () => {
      const imported = await run(COMMANDS.IMPORT_PROFILE, { json: profileJson });
      expect(imported.ok).toBe(true);

      const id = (imported.data as { id: string }).id;
      expect(await run(COMMANDS.APPLY_PROFILE, { id })).toEqual({ ok: true });

      const { settings } = buildState(null);
      expect(settings.defaultPolicy).toBe('pass');
      expect(settings.rules).toHaveLength(1);
      expect(settings.activeProfileId).toBe(id);
    });

    it('adsız profil arayüz dilinde yedek ad alır — sabit Türkçe değil', async () => {
      await run(COMMANDS.IMPORT_PROFILE, { json: JSON.stringify({ rules: [] }) });

      // Varsayılan dil tercihi 'auto'; jsdom’da tarayıcı dili İngilizce
      expect(buildState(null).settings.profiles[0]?.name).toBe('Imported profile');
    });

    it('bozuk JSON ve şemasız dosya reddedilir', async () => {
      expect(await run(COMMANDS.IMPORT_PROFILE, { json: '{' })).toEqual({ ok: false, error: 'invalid-json' });
      expect(await run(COMMANDS.IMPORT_PROFILE, { json: '{"name":"x"}' })).toEqual({ ok: false, error: 'profile-schema' });
    });

    it('olmayan profil uygulanamaz, silinen profil listeden düşer', async () => {
      expect(await run(COMMANDS.APPLY_PROFILE, { id: 'yok' })).toEqual({ ok: false, error: 'not-found' });

      const imported = await run(COMMANDS.IMPORT_PROFILE, { json: profileJson });
      const id = (imported.data as { id: string }).id;

      expect(await run(COMMANDS.DELETE_PROFILE, { id })).toEqual({ ok: true });
      expect(buildState(null).settings.profiles).toHaveLength(0);
    });

    it('seçim yokken dışa aktarma anlık görüntü verir', async () => {
      const result = await run(COMMANDS.EXPORT_PROFILE, {});
      const file = result.data as { content: string; name: string; extension: string };

      expect(result.ok).toBe(true);
      expect(file.extension).toBe('json');
      // Dosya adı da arayüz dilini izler
      expect(file.name.startsWith('dr-sim-profile-')).toBe(true);
      expect(JSON.parse(file.content)).toMatchObject({ id: 'current' });
    });
  });

  describe('rapor', () => {
    it('oturum yokken bile markdown üretir', async () => {
      const result = await run(COMMANDS.EXPORT_REPORT, { format: 'markdown' });
      const file = result.data as { content: string; extension: string; name: string };

      expect(file.extension).toBe('md');
      expect(file.name).toBe('dr-sim-report');
      expect(file.content).toContain('Blocked EPs');
    });

    it('json formatı istenirse json döner', async () => {
      const result = await run(COMMANDS.EXPORT_REPORT, { format: 'json' });
      const file = result.data as { content: string; extension: string };

      expect(file.extension).toBe('json');
      expect(JSON.parse(file.content)).toMatchObject({ blocked: [], passed: [] });
    });
  });

  describe('oturum komutları', () => {
    it('sekme yokken temizleme reddedilir', async () => {
      expect(await run(COMMANDS.CLEAR_INVENTORY, {})).toEqual({ ok: false, error: 'no-tab' });
    });

    it('sekme verilince temizleme çalışır', async () => {
      expect(await run(COMMANDS.CLEAR_INVENTORY, {}, 7)).toEqual({ ok: true });
    });
  });

  describe('ayarlar', () => {
    it('geçerli yama yazılır ve kalıcı depoya düşer', async () => {
      expect(await run(COMMANDS.UPDATE_SETTINGS, { settings: { locale: 'tr', maxLogEntries: 50 } })).toEqual({ ok: true });

      const { settings } = buildState(null);
      expect(settings.locale).toBe('tr');
      expect(settings.maxLogEntries).toBe(50);
    });

    it('yama nesne değilse reddedilir', async () => {
      expect(await run(COMMANDS.UPDATE_SETTINGS, { settings: 'nope' })).toEqual({ ok: false, error: 'invalid-settings' });
      expect(await run(COMMANDS.UPDATE_SETTINGS, {})).toEqual({ ok: false, error: 'invalid-settings' });
    });

    it('varsayılan politika ve arıza güncellenir', async () => {
      await run(COMMANDS.SET_DEFAULT_POLICY, { policy: 'pass' });
      expect(buildState(null).settings.defaultPolicy).toBe('pass');

      await run(COMMANDS.SET_FAULT, { fault: { status: 500, statusText: 'Internal Server Error' } });
      expect(buildState(null).settings.fault).toMatchObject({ kind: 'http', status: 500 });
    });

    it('auto-off süresi verilince alarm kurulur', async () => {
      await run(COMMANDS.SET_ENABLED, { enabled: true, confirmProduction: true });
      await run(COMMANDS.UPDATE_SETTINGS, { settings: { autoOffMinutes: 45 } });

      expect(chromeMock.alarms.create).toHaveBeenCalledWith('drsim-auto-off', { delayInMinutes: 45 });
      expect(buildState(null).autoOffAt).not.toBeNull();
    });
  });

  describe('HARD_RESET', () => {
    const seed = async (): Promise<void> => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });
      await run(COMMANDS.SET_RULE_STATE, { path: '/a', state: 'allow' });
      await run(COMMANDS.SET_DEFAULT_POLICY, { policy: 'pass' });
      await run(COMMANDS.UPDATE_SETTINGS, { settings: { locale: 'tr', maxLogEntries: 42 } });
      await run(COMMANDS.IMPORT_PROFILE, { json: JSON.stringify({ name: 'p', rules: [] }) });
    };

    it('her şeyi varsayılana döndürür', async () => {
      await seed();
      expect((await run(COMMANDS.HARD_RESET)).ok).toBe(true);

      const { settings } = buildState(null);
      expect(settings.domains).toEqual([]);
      expect(settings.pageHosts).toEqual([]);
      expect(settings.rules).toEqual([]);
      expect(settings.profiles).toEqual([]);
      expect(settings.activeProfileId).toBeNull();
      expect(settings.defaultPolicy).toBe('block');
      expect(settings.locale).toBe('auto');
      expect(settings.maxLogEntries).toBe(200);
      expect(settings.enabled).toBe(false);
      expect(settings.fault).toMatchObject({ kind: 'http', status: 503 });
    });

    it('verilen site izinlerini bırakır', async () => {
      chromeMock.permissions.getAll.mockResolvedValueOnce({
        permissions: [],
        origins: ['*://api.example.com/*', '*://panel.example.com/*'],
      });

      await run(COMMANDS.HARD_RESET);

      expect(chromeMock.permissions.remove).toHaveBeenCalledWith({ origins: ['*://api.example.com/*'] });
      expect(chromeMock.permissions.remove).toHaveBeenCalledWith({ origins: ['*://panel.example.com/*'] });
    });

    it('bırakılacak izin yoksa remove çağrılmaz', async () => {
      await run(COMMANDS.HARD_RESET);
      expect(chromeMock.permissions.remove).not.toHaveBeenCalled();
    });

    it('kalıcı ve oturum depolarını temizler', async () => {
      await seed();
      await run(COMMANDS.HARD_RESET);

      expect(chromeMock.storage.local.remove).toHaveBeenCalledWith('drsim.settings');
      expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('drsim.sessions');
    });

    // Not: bekleyen debounce'lu yazmanın sıfırlamayı geri almadığı,
    // settings.store.spec.ts'te izole bir store örneğiyle test ediliyor —
    // burada modül seviyesindeki zamanlayıcılar testler arasında sızıyor.

    it('auto-off alarmı iptal edilir', async () => {
      await run(COMMANDS.SET_ENABLED, { enabled: true, confirmProduction: true });
      await run(COMMANDS.UPDATE_SETTINGS, { settings: { autoOffMinutes: 30 } });

      await run(COMMANDS.HARD_RESET);

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('drsim-auto-off');
      expect(buildState(null).autoOffAt).toBeNull();
    });

    // Chrome, remove() sonrası permissions.onRemoved YAYINLAR. Bu olay
    // syncPermissions'ı tetikler; o da eski ayar anlık görüntüsünü yazarsa
    // sıfırlanan domainler geri gelir.
    it('sıfırlama sırasında gelen izin olayı ayarları geri getirmez', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });
      await run(COMMANDS.ADD_PAGE_HOST, { pattern: 'app.example.com' });

      chromeMock.permissions.getAll.mockResolvedValueOnce({
        permissions: [],
        origins: ['*://api.example.com/*', '*://app.example.com/*'],
      });
      chromeMock.permissions.remove.mockImplementationOnce(async () => {
        chromeMock.permissions.contains.mockResolvedValue(false);
        chromeMock.permissions.onRemoved.emit();
        return true;
      });

      await run(COMMANDS.HARD_RESET);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(buildState(null).settings.domains).toEqual([]);
      expect(buildState(null).settings.pageHosts).toEqual([]);
    });

    // remove() hepsi-ya-hiç çalışır: tek bir kaldırılamaz origin, diğerlerinin de
    // kalmasına yol açardı. Kalan izin, izin penceresinin bir daha hiç
    // açılmamasına sebep olur — Chrome zaten izinli olduğu için dialog göstermez.
    it('origin’ler tek tek bırakılır, biri başarısız olsa diğerleri kalkar', async () => {
      chromeMock.permissions.getAll.mockResolvedValueOnce({
        permissions: [],
        origins: ['*://a.example.com/*', '*://b.example.com/*', '*://c.example.com/*'],
      });
      chromeMock.permissions.remove.mockImplementation(async ({ origins }) => origins?.[0] !== '*://b.example.com/*');

      const result = await run(COMMANDS.HARD_RESET);

      expect(chromeMock.permissions.remove).toHaveBeenCalledTimes(3);
      expect(result.data).toEqual({ remainingOrigins: ['*://b.example.com/*'] });
    });

    it('hepsi bırakılabilirse kalan bildirilmez', async () => {
      chromeMock.permissions.getAll.mockResolvedValueOnce({
        permissions: [],
        origins: ['*://a.example.com/*'],
      });

      const result = await run(COMMANDS.HARD_RESET);

      expect(result.data).toEqual({ remainingOrigins: [] });
    });

    // Kullanıcının bildirdiği akış: sıfırla → domaini yeniden ekle → çalışsın
    it('sıfırlama sonrası domain yeniden eklenip çalışır', async () => {
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });

      chromeMock.permissions.getAll.mockResolvedValueOnce({
        permissions: [],
        origins: ['*://api.example.com/*'],
      });
      chromeMock.permissions.remove.mockImplementationOnce(async () => {
        chromeMock.permissions.contains.mockResolvedValue(false);
        chromeMock.permissions.onRemoved.emit();
        return true;
      });

      await run(COMMANDS.HARD_RESET);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(buildState(null).settings.domains).toEqual([]);

      // Kullanıcı izni yeniden verdi
      chromeMock.permissions.contains.mockResolvedValue(true);
      chromeMock.permissions.onAdded.emit();
      await run(COMMANDS.ADD_DOMAIN, { pattern: 'api.example.com' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      const { domains } = buildState(null).settings;
      expect(domains).toHaveLength(1);
      // granted true olmalı — false olsaydı compileConfig domaini eleyip
      // interceptor her isteği pass-through yapardı ("tüm istekler yeşil")
      expect(domains[0]?.granted).toBe(true);
    });

    it('izinler bırakılamazsa da sıfırlama tamamlanır', async () => {
      await seed();
      chromeMock.permissions.getAll.mockRejectedValueOnce(new Error('nope'));

      expect((await run(COMMANDS.HARD_RESET)).ok).toBe(true);
      expect(buildState(null).settings.rules).toEqual([]);
    });
  });

  describe('içerik portu — sayfa yüklemesi', () => {
    const TAB = 5;
    const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 5); });

    const failRecord = {
      method: 'GET',
      url: 'https://api.example.com/a',
      path: '/a',
      key: 'GET /a',
      status: 503,
      durationMs: 5,
      outcome: 'fail',
      simulated: true,
      reason: 'default-block',
      origin: 'fetch',
      at: 1,
      routePath: '/',
    };

    const connectFrame = async (frameId: number) => {
      const listeners: Array<(message: unknown) => void> = [];
      const port = {
        name: 'drsim-content',
        sender: { tab: { id: TAB }, frameId },
        onMessage: { addListener: (fn: (message: unknown) => void) => listeners.push(fn) },
        onDisconnect: { addListener: () => {} },
        postMessage: vi.fn(),
      };

      chromeMock.runtime.onConnect.emit(port as never);
      await settle();

      return async (message: unknown) => {
        listeners.forEach((fn) => fn(message));
        await settle();
      };
    };

    it('refresh logları sıfırdan başlatır, birikmez', async () => {
      const send = await connectFrame(0);

      await send({ type: 'CONTENT_READY', documentId: 'doc-1' });
      await send({ type: 'TELEMETRY_BATCH', records: [failRecord], dropped: 0 });
      expect(buildState(TAB).session?.failLog).toHaveLength(1);

      // Aynı belge (SW uyanışı / yeniden bağlanma) — silmemeli
      await send({ type: 'CONTENT_READY', documentId: 'doc-1' });
      expect(buildState(TAB).session?.failLog).toHaveLength(1);

      // Gerçek refresh — sıfırlamalı
      await send({ type: 'CONTENT_READY', documentId: 'doc-2' });
      expect(buildState(TAB).session?.failLog).toEqual([]);
      expect(buildState(TAB).session?.inventory).toEqual({});
    });

    // Bridge allFrames ile çalışır: her iframe kendi belge kimliğini gönderir.
    // Üst çerçeve gibi davranırlarsa reklam/analitik iframe'i olan bir sayfada
    // loglar durup dururken silinirdi.
    it('iframe’in belge kimliği sekme oturumunu sıfırlamaz', async () => {
      const top = await connectFrame(0);
      await top({ type: 'CONTENT_READY', documentId: 'doc-1' });
      await top({ type: 'TELEMETRY_BATCH', records: [failRecord], dropped: 0 });

      const frame = await connectFrame(1);
      await frame({ type: 'CONTENT_READY', documentId: 'iframe-doc' });

      expect(buildState(TAB).session?.failLog).toHaveLength(1);
    });

    it('iframe’in route’u panelde gösterilen adresi değiştirmez', async () => {
      const top = await connectFrame(0);
      await top({
        type: 'ROUTE_CHANGE',
        route: { origin: 'https://app.example.com', pathname: '/orders', search: '', hash: '' },
        title: 'Siparişler',
      });

      const frame = await connectFrame(1);
      await frame({
        type: 'ROUTE_CHANGE',
        route: { origin: 'https://ads.example.net', pathname: '/pixel', search: '', hash: '' },
        title: 'reklam',
      });

      const session = buildState(TAB).session;
      expect(session?.origin).toBe('https://app.example.com');
      expect(session?.routePath).toBe('/orders');
    });
  });

  describe('kaldırılan komutlar geri gelmemeli', () => {
    // O2: UI yüzeyi olmayan üç komut silindi. Protokolde kalırlarsa test edilemeyen
    // yüzey geri döner; bu test onları kapıda tutar.
    it.each(['ADD_MANUAL_ENDPOINT', 'BULK_SET_RULE_STATE', 'SAVE_PROFILE', 'CLEAR_LOGS'])(
      '%s artık tanınmıyor',
      async (command) => {
        expect(await run(command)).toEqual({ ok: false, error: 'unknown-command' });
      },
    );
  });

  it('ayarlar kalıcı depoya yazılır', async () => {
    await run(COMMANDS.SET_DEFAULT_POLICY, { policy: 'pass' });

    // Yazma debounce'lu (200 ms). İçeriği bekleriz, "set çağrıldı mı"yı değil:
    // önceki testin modül seviyesindeki zamanlayıcısı araya bir yazma sıkıştırabilir.
    await vi.waitFor(() => {
      const stored = chromeMock.storage.local.__data[STORAGE_KEYS.SETTINGS] as { defaultPolicy?: string } | undefined;
      expect(stored?.defaultPolicy).toBe('pass');
    });
  });
});
