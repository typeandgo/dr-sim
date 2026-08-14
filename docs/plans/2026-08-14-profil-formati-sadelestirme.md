# Profil formatını sadeleştirme — uygulama planı

> **Ajan çalışanlar için:** ZORUNLU ALT SKILL: Bu planı görev görev uygulamak için `superpowers:subagent-driven-development` (önerilen) veya `superpowers:executing-plans` kullanın. Adımlar takip için checkbox (`- [ ]`) söz dizimindedir.

**Hedef:** Profil dosyasını `rules[]` nesne dizisinden `allow` / `block` path dizilerine indirmek ve method'suz eşleşmeyi tüm modele yaymak.

**Mimari:** Değişiklik iki katmana ayrılır. Önce **davranış** iner (karar motoru path'e bakar, tipler aynı kalır), sonra **şekil** küçülür (`Rule` üç alana iner, migration v5 eski kayıtları birleştirir). Ardından envanter, profil dosyası, preset'ler ve kılavuz sırayla hizalanır. Her görev kendi test döngüsüyle biter ve `npm run verify` yeşil kalır.

**Teknoloji:** TypeScript (strict), Vitest + jsdom, Vite (MV3 çoklu giriş), SCSS, ESLint + Stylelint.

**Tasarım belgesi:** `docs/specs/2026-08-14-profil-formati-sadelestirme.md`

## Global kısıtlar

- Her görev `npm run verify` (lint → typecheck → test → build) **yeşil** biterek kapanır. Kırmızı bırakılmış görev tamamlanmış sayılmaz.
- Yorumlar ve test adları **Türkçe**; kod ve tip adları İngilizce. Mevcut dosyaların dili neyse o sürdürülür.
- Yeni kural: **çakışmada `block` kazanır.** Bu karar tek bir fonksiyonda (`resolveConflict`, `core/rules.ts`) yaşar; ikinci bir yerde tekrar yazılmaz.
- `core/i18n.ts` içinde EN sözlüğü tek doğruluk kaynağıdır; her eklenen/çıkarılan anahtar **iki dilde birden** işlenir yoksa derleme kırılır.
- Literal hex yalnızca `_variables.scss` içinde bulunabilir (bu planda stil değişikliği yok, kural yine de geçerli).
- Testler DOM ağacını değil, **gönderilen komutu ve payload'ı** doğrular (repo kuralı 400).
- Commit mesajları Türkçe, conventional prefix'li (`feat:` / `refactor:` / `docs:` / `chore:`).

---

## Dosya yapısı

| Dosya | Sorumluluk | Görev |
|---|---|---|
| `src/core/rules.ts` | Kural listesi mutasyonları + `resolveConflict` | 1, 2 |
| `src/core/compile-config.ts` | Kuralları path→state tablosuna derler | 1 |
| `src/core/decision-engine.ts` | Karar; artık path'e bakar | 1 |
| `src/ui/components/inventory.ts` | Envanter listesi; kural tablosunu `compileRules`'tan alır | 1, 2, 3, 4 |
| `src/core/types.ts` | `Rule`, `InventoryItem`, `Profile` şekilleri | 2, 3, 4 |
| `src/core/path.util.ts` | `toEndpointKey` kalkar | 2 |
| `src/background/stores/settings.store.ts` | v5 migration | 2 |
| `src/background/service-worker.ts` | Komut yüzeyi: kural komutları + import | 2, 4 |
| `src/ui/options/main.ts` | Kural listesi gösterimi | 2 |
| `src/ui/components/log-list.ts` | Hızlı izin payload'ı | 2 |
| `src/background/stores/session.store.ts` | Envanter path'e anahtarlanır, `methods` toplanır | 3 |
| `src/core/report.builder.ts` | Rapor satır biçimi | 3 |
| `src/core/profile.ts` | Dosya serileştirme + anlık görüntü | 4 |
| `scripts/build-preset.mjs` + `src/presets/*.json` | Preset üretimi | 5 |
| `docs/guide.md`, `docs/guide.tr.md` | Profil alanları bölümü | 6 |

---

## Görev 1: Karar motoru path'e bakar

Davranış değişikliğinin tamamı burada. `Rule` tipi **değişmiyor** — bu yüzden hiçbir tüketici kırılmıyor ve görev tek başına yeşil kapanıyor.

**Dosyalar:**
- Değiştir: `src/core/rules.ts` (dosya sonuna `resolveConflict`)
- Değiştir: `src/core/compile-config.ts:5-12` (`compileRules`)
- Değiştir: `src/core/decision-engine.ts:15-38` (`decide`)
- Değiştir: `src/ui/components/inventory.ts` (`rulesByKey` → `compileRules`)
- Test: `src/core/rules.spec.ts`, `src/core/compile-config.spec.ts`, `src/core/decision-engine.spec.ts`, `src/ui/components/inventory.spec.ts`

**Arayüzler:**
- Üretir: `resolveConflict(a: RuleState, b: RuleState): RuleState` — `core/rules.ts`'ten export. Görev 2 (migration) ve Görev 4 (import) bunu kullanacak.
- Üretir: `compileRules(rules: Rule[]): Record<string, RuleState>` — anahtar artık **path**, `METHOD path` değil.

- [ ] **Adım 1: `resolveConflict` için düşen testi yaz**

`src/core/rules.spec.ts` dosyasının sonuna, `describe` bloğunun içine:

```ts
  describe('resolveConflict', () => {
    it('block her zaman kazanır — DR aracında güvenli taraf kesmektir', () => {
      expect(resolveConflict('allow', 'block')).toBe('block');
      expect(resolveConflict('block', 'allow')).toBe('block');
      expect(resolveConflict('block', 'block')).toBe('block');
    });

    it('iki taraf da allow ise allow kalır', () => {
      expect(resolveConflict('allow', 'allow')).toBe('allow');
    });
  });
```

Dosyanın en üstündeki import satırına `resolveConflict` ekle.

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/core/rules.spec.ts`
Beklenen: FAIL — `resolveConflict is not a function`

- [ ] **Adım 3: `resolveConflict`'i yaz**

`src/core/rules.ts` dosyasının sonuna:

```ts
// İki kural aynı path'e indiğinde durumu çözer. Block kazanır: DR aracında bir
// EP'yi yanlışlıkla AÇIK bırakmak, yanlışlıkla kapatmaktan daha kötü bir teşhis
// hatası üretir — kapalı EP hemen görülür, açık kalan EP testi sessizce yalancı
// yeşile çevirir. Import, migration ve derleme aynı bu fonksiyonu kullanır.
export const resolveConflict = (a: RuleState, b: RuleState): RuleState => (a === 'block' || b === 'block' ? 'block' : 'allow');
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/core/rules.spec.ts`
Beklenen: PASS

- [ ] **Adım 5: `compileRules` için düşen testi yaz**

`src/core/compile-config.spec.ts` içine:

```ts
  it('kurallar path’e anahtarlanır, method anahtara girmez', () => {
    const compiled = compileRules([
      { key: 'GET /orders', method: 'GET', path: '/orders', state: 'allow', source: 'manual', createdAt: 0 },
    ]);

    expect(compiled).toEqual({ '/orders': 'allow' });
  });

  it('aynı path’in iki kaydı çakışırsa block kazanır', () => {
    const compiled = compileRules([
      { key: 'GET /orders', method: 'GET', path: '/orders', state: 'allow', source: 'manual', createdAt: 0 },
      { key: 'POST /orders', method: 'POST', path: '/orders', state: 'block', source: 'manual', createdAt: 0 },
    ]);

    expect(compiled).toEqual({ '/orders': 'block' });
  });
```

- [ ] **Adım 6: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/core/compile-config.spec.ts`
Beklenen: FAIL — çıktı `{ 'GET /orders': 'allow' }` geliyor

- [ ] **Adım 7: `compileRules`'u path'e çevir**

`src/core/compile-config.ts` içinde `compileRules`'u değiştir ve `resolveConflict`'i içe aktar:

```ts
import { resolveConflict } from './rules';

// Kurallar SW'de bir kez derlenir; MAIN world karar anında yalnızca tek lookup yapar (01 §8).
// Anahtar PATH'tir (Revizyon 59): bir EP'nin tek durumu vardır ve o durum path'in
// bütün method'ları için geçerlidir.
export const compileRules = (rules: Rule[]): Record<string, RuleState> => {
  const compiled: Record<string, RuleState> = Object.create(null) as Record<string, RuleState>;
  rules.forEach((rule) => {
    const existing = compiled[rule.path];
    compiled[rule.path] = existing === undefined ? rule.state : resolveConflict(existing, rule.state);
  });
  return compiled;
};
```

- [ ] **Adım 8: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/core/compile-config.spec.ts`
Beklenen: PASS

- [ ] **Adım 9: `decide` için düşen testi yaz**

`src/core/decision-engine.spec.ts` içine:

```ts
  it('kural path’e yazılınca o path’in HER method’u aynı kararı alır', () => {
    const config = { ...baseConfig, enabled: true, rulesByKey: { '/orders': 'allow' as const } };

    expect(decide({ method: 'GET', url: 'https://api.x.com/orders' }, config).reason).toBe('allowed');
    expect(decide({ method: 'POST', url: 'https://api.x.com/orders' }, config).reason).toBe('allowed');
    expect(decide({ method: 'DELETE', url: 'https://api.x.com/orders' }, config).reason).toBe('allowed');
  });

  it('karar path’e bakar ama Decision.key method’u taşımaya devam eder', () => {
    const config = { ...baseConfig, enabled: true, rulesByKey: { '/orders': 'block' as const } };
    const decision = decide({ method: 'POST', url: 'https://api.x.com/orders' }, config);

    expect(decision.block).toBe(true);
    expect(decision.key).toBe('POST /orders');
    expect(decision.method).toBe('POST');
  });
```

Bu dosyada `config(over)` ve `url(path)` yardımcıları zaten kurulu (satır 7-21); testleri onlarla yaz:

```ts
  it('kural path’e yazılınca o path’in HER method’u aynı kararı alır', () => {
    const cfg = config({ rulesByKey: { '/orders': 'allow' } });

    expect(decide({ method: 'GET', url: url('/orders') }, cfg).reason).toBe('allowed');
    expect(decide({ method: 'POST', url: url('/orders') }, cfg).reason).toBe('allowed');
    expect(decide({ method: 'DELETE', url: url('/orders') }, cfg).reason).toBe('allowed');
  });

  it('karar path’e bakar ama Decision.key method’u taşımaya devam eder', () => {
    const decision = decide({ method: 'POST', url: url('/orders') }, config({ rulesByKey: { '/orders': 'block' } }));

    expect(decision.block).toBe(true);
    expect(decision.key).toBe('POST /orders');
    expect(decision.method).toBe('POST');
  });
```

- [ ] **Adım 10: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/core/decision-engine.spec.ts`
Beklenen: FAIL — POST çağrısı `default-block` / `default-pass` dönüyor

- [ ] **Adım 11: `decide`'ı path'e çevir**

`src/core/decision-engine.ts` içinde yalnızca lookup satırı değişir:

```ts
  // Lookup PATH ile yapılır (Revizyon 59): method karara girmez. `key` yalnızca
  // gözlem tarafı için üretilir — envanter satırı, loglar ve rapor method'u
  // göstermeye devam ediyor.
  const state = config.rulesByKey[path];
```

Dosyanın başındaki sözleşme yorumuna bir cümle ekle:

```ts
// Bir EP = bir PATH'tir. Method eşleşmeye girmez; /orders için yazılan kural
// GET, POST ve DELETE için aynı anda geçerlidir.
```

- [ ] **Adım 12: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/core/decision-engine.spec.ts`
Beklenen: PASS

- [ ] **Adım 13: Envanteri aynı tabloya bağla**

`src/ui/components/inventory.ts` içinde `rulesByKey` fonksiyonunu sil ve yerine `compileRules`'u kullan. İçe aktarma satırına ekle:

```ts
import { compileRules } from '@/core/compile-config';
```

`rulesByKey` tanımını şununla değiştir:

```ts
  // Panelin gördüğü tablo ile karar motorunun gördüğü tablo AYNI fonksiyondan
  // gelir (Revizyon 59): ikisi ayrı kurulsaydı çakışma çözümü iki yerde yaşar ve
  // panel "İzinli" derken motor bloklayabilirdi.
  const rulesByPath = (): Record<string, RuleState> => compileRules(state?.settings.rules ?? []);
```

Kullanım yerlerini güncelle — `rulesByKey()` çağrılarının hepsi `rulesByPath()` olur ve `[item.key]` yerine `[item.path]` ile okunur. Üç yer var: satır güncelleyicideki `explicit`, `visibleItems` içindeki filtre, `render` içindeki `blockedCount`.

- [ ] **Adım 14: Envanter testini çalıştır**

Çalıştır: `npx vitest run src/ui/components/inventory.spec.ts`
Beklenen: PASS (mevcut testler değişmeden geçmeli — fixture `key: 'GET /offers'`, `path: '/offers'` taşıyor)

- [ ] **Adım 15: Tam doğrulama**

Çalıştır: `npm run verify`
Beklenen: lint, typecheck, tüm testler ve build yeşil

- [ ] **Adım 16: Commit**

```bash
git add src/core/rules.ts src/core/rules.spec.ts src/core/compile-config.ts src/core/compile-config.spec.ts src/core/decision-engine.ts src/core/decision-engine.spec.ts src/ui/components/inventory.ts
git commit -m "feat: kural eşleşmesini path'e indir, method karara girmesin"
```

---

## Görev 2: `Rule` üç alana iner + v5 migration

**Dosyalar:**
- Değiştir: `src/core/types.ts` (`Rule`, `RuleSource` kalkar)
- Değiştir: `src/core/path.util.ts` (`toEndpointKey` kalkar)
- Değiştir: `src/core/rules.ts` (`RuleInput`, `findRule`, `upsertRule`, `removeRule`, `toggleRule`)
- Değiştir: `src/core/constants.ts` (`SCHEMA_VERSION` 4 → 5)
- Değiştir: `src/background/stores/settings.store.ts` (migration 4→5)
- Değiştir: `src/background/service-worker.ts` (`toggleRuleState`, `setRuleState`, `REMOVE_RULE`)
- Değiştir: `src/ui/options/main.ts` (kural listesi)
- Değiştir: `src/ui/components/inventory.ts` (toggle/remove payload'ları)
- Değiştir: `src/ui/components/log-list.ts` (hızlı izin payload'ı)
- Değiştir: `src/core/i18n.ts` (`error.invalid-key` kalkar)
- Test: `src/core/rules.spec.ts`, `src/background/stores/settings.store.spec.ts`, `src/background/service-worker.spec.ts`, `src/ui/components/inventory.spec.ts`, `src/ui/components/log-list.spec.ts`, `src/core/report.builder.spec.ts`

**Arayüzler:**
- Tüketir: `resolveConflict` (Görev 1)
- Üretir: `Rule = { path: string; state: RuleState; createdAt: number }`
- Üretir: `upsertRule(rules, { path, state, now? }, normalization?)`, `toggleRule(rules, { path, defaultPolicy, now? })`, `removeRule(rules, path)`, `findRule(rules, path)`
- Üretir: Komut payload'ları — `TOGGLE_RULE_STATE { path }`, `SET_RULE_STATE { path, state }`, `REMOVE_RULE { path }`

- [ ] **Adım 1: v5 migration için düşen testi yaz**

`src/background/stores/settings.store.spec.ts` içine:

```ts
  it('v5: kurallar path’e iner, çakışan durumda block kazanır', () => {
    const migrated = migrate({
      schemaVersion: 4,
      rules: [
        { key: 'GET /orders', method: 'GET', path: '/orders', state: 'allow', source: 'manual', note: 'x', createdAt: 100 },
        { key: 'POST /orders', method: 'POST', path: '/orders', state: 'block', source: 'preset', createdAt: 50 },
        { key: 'GET /users', method: 'GET', path: '/users', state: 'allow', source: 'manual', createdAt: 200 },
      ],
    });

    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.rules).toEqual([
      { path: '/orders', state: 'block', createdAt: 50 },
      { path: '/users', state: 'allow', createdAt: 200 },
    ]);
  });

  it('v5: kural listesi yoksa boş dizi üretir', () => {
    expect(migrate({ schemaVersion: 4 }).rules).toEqual([]);
  });
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/background/stores/settings.store.spec.ts`
Beklenen: FAIL — `schemaVersion` 4 kalıyor

- [ ] **Adım 3: `SCHEMA_VERSION`'ı ve migration'ı yaz**

`src/core/constants.ts`:

```ts
export const SCHEMA_VERSION = 5;
```

`src/background/stores/settings.store.ts` içinde `migrations` nesnesine ekle:

```ts
  // v5: kural anahtarı METHOD+path'ten yalnız path'e indi (Revizyon 59).
  // Aynı path'e inen kayıtlar birleşir; durum çakışırsa block kazanır ve
  // createdAt en eski kayıttan devralınır — kuralın listeye ilk giriş anı odur.
  4: (data) => {
    const merged = new Map<string, { path: string; state: RuleState; createdAt: number }>();

    (Array.isArray(data.rules) ? data.rules : []).forEach((raw) => {
      const rule = raw as { path?: unknown; state?: unknown; createdAt?: unknown };
      const path = typeof rule.path === 'string' ? rule.path : '';
      if (!path) return;

      const state: RuleState = rule.state === 'block' ? 'block' : 'allow';
      const createdAt = typeof rule.createdAt === 'number' ? rule.createdAt : 0;
      const existing = merged.get(path);

      merged.set(path, existing
        ? { path, state: resolveConflict(existing.state, state), createdAt: Math.min(existing.createdAt, createdAt) }
        : { path, state, createdAt });
    });

    return { ...data, rules: [...merged.values()], schemaVersion: 5 };
  },
```

Dosyanın başına gereken import'ları ekle: `import { resolveConflict } from '@/core/rules';` ve tip için `RuleState`.

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/background/stores/settings.store.spec.ts`
Beklenen: PASS

- [ ] **Adım 5: `rules.ts` için düşen testleri yaz**

`src/core/rules.spec.ts` içindeki mevcut `upsertRule` / `toggleRule` / `removeRule` testlerini yeni imzaya çevir ve şunu ekle:

```ts
  it('aynı path ikinci kez yazılınca kayıt çoğalmaz, durum güncellenir', () => {
    const first = upsertRule([], { path: '/orders', state: 'allow', now: 10 });
    const second = upsertRule(first, { path: '/orders', state: 'block', now: 99 });

    expect(second).toEqual([{ path: '/orders', state: 'block', createdAt: 10 }]);
  });

  it('path normalize edilerek anahtarlanır', () => {
    const rules = upsertRule([], { path: '/orders/8842/detail', state: 'block', now: 0 });

    expect(rules[0]!.path).toBe('/orders/:id/detail');
  });
```

- [ ] **Adım 6: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/core/rules.spec.ts`
Beklenen: FAIL — `method` zorunlu olduğu için tip hatası / kayıt `key` taşıyor

- [ ] **Adım 7: `Rule` tipini ve `rules.ts`'i küçült**

`src/core/types.ts` — `RuleSource` tipini sil, `Rule`'u değiştir:

```ts
// Tek kural kaydı: bir PATH'in açık durumu. Joker yok, method yok — bir path'in
// tek bir durumu vardır ve o durum bütün method'ları için geçerlidir (Revizyon 59).
export interface Rule {
  path: string; // normalize edilmiş: /items/:id/summary
  state: RuleState;
  createdAt: number;
}
```

`src/core/path.util.ts` — `toEndpointKey` fonksiyonunu ve altındaki yorumu sil. `normalizeMethod` **kalır** (gözlem tarafı kullanıyor).

`src/core/rules.ts` — mutasyonları yeniden yaz:

```ts
export interface RuleInput {
  path: string;
  state: RuleState;
  now?: number;
}

export const findRule = (rules: Rule[], path: string): Rule | undefined => rules.find((rule) => rule.path === path);

export const upsertRule = (rules: Rule[], input: RuleInput, normalization?: NormalizationRules): Rule[] => {
  const path = normalizePath(input.path, normalization);
  const existing = findRule(rules, path);
  const rule: Rule = { path, state: input.state, createdAt: existing?.createdAt ?? input.now ?? 0 };

  return existing ? rules.map((item) => (item.path === path ? rule : item)) : [...rules, rule];
};

export const removeRule = (rules: Rule[], path: string): Rule[] => rules.filter((rule) => rule.path !== path);

// Toggle: efektif durumu tersine çevirir; kayıt yoksa varsayılan politikanın tersini yazar.
export const toggleRule = (
  rules: Rule[],
  input: { path: string; defaultPolicy: DefaultPolicy; now?: number },
  normalization?: NormalizationRules,
): Rule[] => {
  const path = normalizePath(input.path, normalization);
  const existing = findRule(rules, path);

  return upsertRule(rules, { path, state: nextRuleState(existing?.state, input.defaultPolicy), now: input.now }, normalization);
};
```

Kullanılmayan import'ları temizle (`normalizeMethod`, `toEndpointKey`, `RuleSource`).

- [ ] **Adım 8: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/core/rules.spec.ts`
Beklenen: PASS

- [ ] **Adım 9: Komut yüzeyini path'e çevir**

`src/background/service-worker.ts`:

```ts
const toggleRuleState = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const validation = validateRulePath(asString(payload.path));
  if (!validation.ok) return { ok: false, error: validation.error };

  await settingsStore.mutate((current) => ({
    ...current,
    rules: toggleRule(current.rules, {
      path: validation.path,
      defaultPolicy: current.defaultPolicy,
      now: Date.now(),
    }),
  }));

  return { ok: true };
};

const setRuleState = async ({ payload }: CommandContext): Promise<CommandResult> => {
  const validation = validateRulePath(asString(payload.path));
  if (!validation.ok) return { ok: false, error: validation.error };

  await settingsStore.mutate((current) => ({
    ...current,
    rules: upsertRule(current.rules, {
      path: validation.path,
      state: payload.state === 'block' ? 'block' : 'allow',
      now: Date.now(),
    }),
  }));

  return { ok: true };
};
```

`REMOVE_RULE` handler'ında `asString(payload.key)` → `asString(payload.path)`.

- [ ] **Adım 10: Çağıran yüzeyleri güncelle**

`src/ui/components/inventory.ts` — iki payload:

```ts
void ctx.send(COMMANDS.TOGGLE_RULE_STATE, { path: item.path });
```
```ts
const remove = button('✕', () => void ctx.send(COMMANDS.REMOVE_RULE, { path: item.path }), {
```

`src/ui/components/log-list.ts` — hızlı izin:

```ts
      const quickAllow = button(ctx.t('common.allow'), () => {
        void ctx.send(COMMANDS.SET_RULE_STATE, { path: entry.path, state: 'allow' });
      }, { class: 'drsim-button drsim-button--compact', dataset: { test: 'dr-sim-quick-allow' } });
```

`src/ui/options/main.ts` — `renderRules` içinde `rule.key` yerine `rule.path`:

```ts
    const signature = rules.map((rule) => `${rule.path}:${rule.state}`).join('|');
```
```ts
    const sorted = [...rules].sort((a, b) => a.path.localeCompare(b.path));
```
```ts
        h('span', { class: 'drsim-ep', text: rule.path }),
```
```ts
          button('✕', () => void connection.send(COMMANDS.REMOVE_RULE, { path: rule.path }), {
```

`src/core/i18n.ts` — `'error.invalid-key'` anahtarını **iki dilden de** sil (artık üretilmiyor).

- [ ] **Adım 11: Komut testlerini güncelle ve yaz**

`src/background/service-worker.spec.ts` içindeki kural testlerini yeni payload'a çevir, şunu ekle:

```ts
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
```

- [ ] **Adım 12: Tam doğrulama**

Çalıştır: `npm run verify`
Beklenen: yeşil. Kırmızıysa kalan `rule.key` / `rule.method` / `rule.source` okumalarını `grep -rn "rule\.key\|rule\.method\|rule\.source" src/` ile bul ve temizle.

- [ ] **Adım 13: Commit**

```bash
git add -A
git commit -m "refactor: Rule kaydını path/state/createdAt üçlüsüne indir"
```

---

## Görev 3: Envanter path başına tek satır

**Dosyalar:**
- Değiştir: `src/core/types.ts` (`InventoryItem`)
- Değiştir: `src/background/stores/session.store.ts` (`upsertInventory`)
- Değiştir: `src/ui/components/inventory.ts` (satır gösterimi + method etiketleri)
- Değiştir: `src/core/report.builder.ts`
- Test: `src/background/stores/session.store.spec.ts`, `src/ui/components/inventory.spec.ts`, `src/core/report.builder.spec.ts`

**Arayüzler:**
- Üretir: `InventoryItem.methods: HttpMethod[]` — ilk görülme sırasına göre, tekrarsız. `InventoryItem.method` kalkar. `InventoryItem.key === InventoryItem.path`.

- [ ] **Adım 1: Envanter birleşmesi için düşen testi yaz**

`src/background/stores/session.store.spec.ts` içine:

```ts
  it('aynı path’in farklı method’ları tek envanter satırında toplanır', () => {
    const sessions = store();

    sessions.applyTelemetry(1, [
      { ...record(), method: 'GET', key: 'GET /orders', path: '/orders' },
      { ...record(), method: 'POST', key: 'POST /orders', path: '/orders' },
      { ...record(), method: 'GET', key: 'GET /orders', path: '/orders' },
    ], 0, settings());

    const inventory = sessions.get(1)!.inventory;

    expect(Object.keys(inventory)).toEqual(['/orders']);
    expect(inventory['/orders']!.methods).toEqual(['GET', 'POST']);
    expect(inventory['/orders']!.count).toBe(3);
  });
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/background/stores/session.store.spec.ts`
Beklenen: FAIL — iki ayrı anahtar (`GET /orders`, `POST /orders`) oluşuyor

- [ ] **Adım 3: `InventoryItem` ve `upsertInventory`'yi çevir**

`src/core/types.ts`:

```ts
export interface InventoryItem {
  key: string; // = path; liste kimliği olarak korunur
  path: string;
  // Bu path'te GÖZLENEN method'lar, ilk görülme sırasına göre. Karara girmez;
  // yalnızca satırda etiket olarak gösterilir (Revizyon 59).
  methods: HttpMethod[];
  sampleUrl: string;
  count: number;
  lastAt: number;
  lastStatus: number | null;
  lastDurationMs: number | null;
  successCount: number;
  failCount: number;
  simulatedCount: number;
  lastReason: DecisionReason;
  origin: RequestOrigin;
  frameId: number;
}
```

`src/background/stores/session.store.ts` içinde `upsertInventory`:

```ts
  const upsertInventory = (session: TabSession, record: TelemetryRecord, settings: Settings): void => {
    const path = record.path;
    const existing = session.inventory[path];
    const isFail = record.outcome === 'fail';
    const method = record.method.toUpperCase() as HttpMethod;

    session.inventory[path] = {
      key: path,
      path,
      // `methods ?? []` zorunlu: `storage.session`'da bu alanı taşımayan eski bir
      // kayıt hydrate edilebilir ve `existing.methods.includes` orada patlardı.
      methods: existing?.methods?.includes(method) ? existing.methods : [...(existing?.methods ?? []), method],
      sampleUrl: record.url,
      count: (existing?.count ?? 0) + 1,
      lastAt: record.at,
      lastStatus: record.status,
      lastDurationMs: record.durationMs,
      successCount: (existing?.successCount ?? 0) + (isFail ? 0 : 1),
      failCount: (existing?.failCount ?? 0) + (isFail ? 1 : 0),
      simulatedCount: (existing?.simulatedCount ?? 0) + (record.simulated ? 1 : 0),
      lastReason: record.reason,
      origin: record.origin,
      frameId: 0,
    };

    const pruned = pruneInventory(session.inventory, settings.maxInventoryItems);
    session.inventory = pruned.inventory;
    session.droppedCount += pruned.dropped;
  };
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/background/stores/session.store.spec.ts`
Beklenen: PASS

- [ ] **Adım 5: Envanter satırı için düşen testi yaz**

`src/ui/components/inventory.spec.ts` — fixture'a `methods` ekle (`method` alanını sil), sonra:

```ts
    it('satır path yazar, method’lar etiket olarak durur', () => {
      const { root, component } = setup();
      component.update(state({}, [item({ methods: ['GET', 'POST'] })]));

      expect(root.querySelector('.drsim-ep')!.textContent).toBe('/offers');
      expect(tagsOf(root)).toEqual(['sayfa', 'GET', 'POST']);
    });
```

`tagsOf` yardımcısı dosyada zaten var (kaynak etiketi bloğunda); gerekiyorsa `describe` dışına taşı.

- [ ] **Adım 6: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/ui/components/inventory.spec.ts`
Beklenen: FAIL — satır `undefined /offers` yazıyor

- [ ] **Adım 7: Envanter gösterimini çevir**

`src/ui/components/inventory.ts` satır güncelleyicisinde:

```ts
      setText(ep, item.path);
```
```ts
      toggle.setAttribute('aria-label', `${item.path} — ${ctx.t(blocked ? 'common.blocked' : 'common.allowed')}`);
```

Etiket listesine method'ları ekle:

```ts
      const wanted = [
        ctx.t(profileKeys.has(item.path) ? 'tag.profile' : 'tag.page'),
        ...(item.methods ?? []),
        item.origin === 'xhr' ? ctx.t('tag.xhr') : null,
        item.lastReason === 'sync-xhr' ? ctx.t('tag.syncXhr') : null,
      ].filter((label): label is string => label !== null);
```

Arama filtresi `item.key` yerine `item.path` üzerinden çalışsın (`visibleItems` içinde).

- [ ] **Adım 8: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/ui/components/inventory.spec.ts`
Beklenen: PASS

- [ ] **Adım 9: Raporu güncelle**

`src/core/report.builder.ts:29` satırındaki biçimi değiştir:

```ts
  ? items.map((item) => `- ${item.path} (${item.methods.join(', ')})`).join('\n')
```

`src/core/report.builder.spec.ts` içindeki beklentiyi ve fixture'ı buna göre güncelle.

- [ ] **Adım 10: Tam doğrulama**

Çalıştır: `npm run verify`
Beklenen: yeşil

- [ ] **Adım 11: Commit**

```bash
git add -A
git commit -m "feat: envanteri path başına tek satıra indir, method'ları etikete çevir"
```

---

## Görev 4: Profil dosya formatı

**Dosyalar:**
- Değiştir: `src/core/types.ts` (`Profile`)
- Değiştir: `src/core/profile.ts` (`buildProfileFile`, `snapshotProfile`, yeni `profileToRules`)
- Değiştir: `src/background/service-worker.ts` (`importProfile`, `applyProfile`)
- Değiştir: `src/ui/components/inventory.ts` (profil etiketi kaynağı)
- Değiştir: `src/core/i18n.ts` (`error.profile-schema` metni)
- Test: `src/core/profile.spec.ts`, `src/background/service-worker.spec.ts`, `src/ui/components/inventory.spec.ts`

**Arayüzler:**
- Tüketir: `resolveConflict` (Görev 1), `validateRulePath` (`core/rules.ts`), `validateDomainPattern` (`core/matcher.ts`)
- Üretir: `Profile = { id, name, defaultPolicy, domains: string[], allow: string[], block: string[], fault, updatedAt }`
- Üretir: `profileToRules(profile: Profile, now: number): Rule[]` — `core/profile.ts`'ten export

- [ ] **Adım 1: Serileştirme için düşen testi yaz**

`src/core/profile.spec.ts` içine:

```ts
  it('dosyaya id ve updatedAt yazılmaz', () => {
    const file = buildProfileFile({
      id: 'p1',
      name: 'DR',
      defaultPolicy: 'pass',
      domains: ['api.x.com'],
      allow: ['/users/current'],
      block: ['/payments/checkout'],
      fault: DEFAULT_FAULT,
      updatedAt: 123,
    }, t);

    const parsed = JSON.parse(file.content);

    expect(parsed).toEqual({
      name: 'DR',
      defaultPolicy: 'pass',
      domains: ['api.x.com'],
      allow: ['/users/current'],
      block: ['/payments/checkout'],
      fault: DEFAULT_FAULT,
    });
  });

  it('anlık görüntü kuralları iki listeye ayırır ve domainleri stringe indirir', () => {
    const profile = snapshotProfile({
      ...DEFAULT_SETTINGS,
      domains: [{ id: 'd1', pattern: 'api.x.com', granted: true }],
      rules: [
        { path: '/users/current', state: 'allow', createdAt: 0 },
        { path: '/payments/checkout', state: 'block', createdAt: 0 },
      ],
    }, 'p1', 'DR', 5);

    expect(profile.allow).toEqual(['/users/current']);
    expect(profile.block).toEqual(['/payments/checkout']);
    expect(profile.domains).toEqual(['api.x.com']);
  });
```

- [ ] **Adım 2: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/core/profile.spec.ts`
Beklenen: FAIL — `Profile` hâlâ `rules` bekliyor

- [ ] **Adım 3: `Profile` tipini ve `profile.ts`'i yaz**

`src/core/types.ts`:

```ts
// Profil = paylaşılabilir DR kurulumu. Dosyanın şeklini BİREBİR taşır: `id` ve
// `updatedAt` yerel defterdir ve dosyaya yazılmaz (Revizyon 59).
export interface Profile {
  id: string;
  name: string;
  defaultPolicy: DefaultPolicy;
  domains: string[];
  allow: string[];
  block: string[];
  fault: FaultConfig;
  updatedAt: number;
}
```

`src/core/profile.ts`:

```ts
// Dosyaya yazılan biçim: yerel defter alanları ayıklanır. Profile nesnesi zaten
// dosyanın şeklini taşıdığı için başka çeviri yoktur — "seçili profil AYNEN
// dışa aktarılır" sözleşmesi (Revizyon 31) böyle korunuyor.
export const buildProfileFile = (profile: Profile, t: Translate): ProfileFile => {
  const { id, updatedAt, ...file } = profile;

  return {
    content: JSON.stringify(file, null, 2),
    extension: 'json',
    name: profileFileName(profile, t),
  };
};

export const snapshotProfile = (settings: Settings, id: string, name: string, now: number): Profile => ({
  id,
  name,
  defaultPolicy: settings.defaultPolicy,
  domains: settings.domains.map((domain) => domain.pattern),
  allow: settings.rules.filter((rule) => rule.state === 'allow').map((rule) => rule.path),
  block: settings.rules.filter((rule) => rule.state === 'block').map((rule) => rule.path),
  fault: settings.fault,
  updatedAt: now,
});

// Profil listeleri kural listesine çevrilir. Bir path iki listede birden geçerse
// `resolveConflict` karar verir — block kazanır.
export const profileToRules = (profile: Profile, now: number): Rule[] => {
  const merged = new Map<string, RuleState>();

  const add = (paths: string[], state: RuleState): void => paths.forEach((raw) => {
    const validation = validateRulePath(raw);
    if (!validation.ok) return;
    const existing = merged.get(validation.path);
    merged.set(validation.path, existing === undefined ? state : resolveConflict(existing, state));
  });

  add(profile.allow, 'allow');
  add(profile.block, 'block');

  return [...merged].map(([path, state]) => ({ path, state, createdAt: now }));
};
```

**Destructuring kullanma.** Repo'nun ESLint ayarı `@typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_' }]` — `ignoreRestSiblings` açık değil, yani `const { id, updatedAt, ...file }` iki kullanılmayan değişken üretip lint'i kırar. Dosyaya yazılacak nesneyi açıkça kur:

```ts
export const buildProfileFile = (profile: Profile, t: Translate): ProfileFile => ({
  content: JSON.stringify({
    name: profile.name,
    defaultPolicy: profile.defaultPolicy,
    domains: profile.domains,
    allow: profile.allow,
    block: profile.block,
    fault: profile.fault,
  }, null, 2),
  extension: 'json',
  name: profileFileName(profile, t),
});
```

Açık nesne ayrıca dosya alan sırasını sabitliyor: aynı profil her dışa aktarımda byte-byte aynı çıkıyor.

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/core/profile.spec.ts`
Beklenen: PASS

- [ ] **Adım 5: Import için düşen testi yaz**

`src/background/service-worker.spec.ts` içine:

```ts
  describe('profil import — yeni şema', () => {
    const file = (over: Record<string, unknown> = {}) => JSON.stringify({
      name: 'DR turu',
      defaultPolicy: 'pass',
      domains: ['api.x.com'],
      block: ['/payments/checkout'],
      ...over,
    });

    it('allow/block listeleriyle gelen dosya kabul edilir', async () => {
      const result = await run(COMMANDS.IMPORT_PROFILE, { json: file() });

      expect(result.ok).toBe(true);
      const [profile] = buildState(null).settings.profiles;
      expect(profile?.block).toEqual(['/payments/checkout']);
      expect(profile?.allow).toEqual([]);
      expect(profile?.domains).toEqual(['api.x.com']);
    });

    it('eski rules[] biçimi reddedilir', async () => {
      const json = JSON.stringify({ name: 'eski', rules: [{ key: 'GET /x', method: 'GET', path: '/x', state: 'block' }] });

      expect(await run(COMMANDS.IMPORT_PROFILE, { json })).toEqual({ ok: false, error: 'profile-schema' });
    });

    it('geçersiz path atlanır, dosya reddedilmez', async () => {
      const result = await run(COMMANDS.IMPORT_PROFILE, { json: file({ block: ['/ok', '/*', ''] }) });

      expect(result.ok).toBe(true);
      expect(buildState(null).settings.profiles[0]?.block).toEqual(['/ok']);
    });

    it('aynı isimle ikinci import üzerine yazar, kopya üretmez', async () => {
      await run(COMMANDS.IMPORT_PROFILE, { json: file() });
      await run(COMMANDS.IMPORT_PROFILE, { json: file({ block: ['/baska'] }) });

      const { profiles } = buildState(null).settings;
      expect(profiles).toHaveLength(1);
      expect(profiles[0]?.block).toEqual(['/baska']);
    });

    it('uygulanınca iki listede geçen path block olur', async () => {
      await run(COMMANDS.IMPORT_PROFILE, { json: file({ allow: ['/x'], block: ['/x'] }) });
      const { id } = buildState(null).settings.profiles[0]!;

      await run(COMMANDS.APPLY_PROFILE, { id });

      expect(buildState(null).settings.rules).toEqual([
        { path: '/x', state: 'block', createdAt: expect.any(Number) },
      ]);
    });
  });
```

- [ ] **Adım 6: Testi çalıştır, düştüğünü gör**

Çalıştır: `npx vitest run src/background/service-worker.spec.ts`
Beklenen: FAIL — `importProfile` `rules` dizisi arıyor

- [ ] **Adım 7: `importProfile` ve `applyProfile`'ı yaz**

`src/background/service-worker.ts`:

```ts
const asPathList = (value: unknown): string[] => (Array.isArray(value) ? value : [])
  .filter((entry): entry is string => typeof entry === 'string')
  .map((entry) => validateRulePath(entry))
  .filter((result): result is { ok: true; path: string } => result.ok)
  .map((result) => result.path);

const asDomainList = (value: unknown): string[] => (Array.isArray(value) ? value : [])
  .filter((entry): entry is string => typeof entry === 'string')
  .map((entry) => validateDomainPattern(entry))
  .filter((result): result is { ok: true; pattern: string } => result.ok)
  .map((result) => result.pattern);

const importProfile = async ({ payload }: CommandContext): Promise<CommandResult> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(asString(payload.json));
  } catch {
    return { ok: false, error: 'invalid-json' };
  }

  const candidate = parsed as Record<string, unknown> | null;

  // Geçerlilik koşulu tek: en az bir liste. Eski `rules[]` dosyaları da tam
  // buradan reddolur — ayrı bir uyumluluk kontrolü yok (Revizyon 59).
  if (!candidate || typeof candidate !== 'object'
    || (!Array.isArray(candidate.allow) && !Array.isArray(candidate.block))) {
    return { ok: false, error: 'profile-schema' };
  }

  const name = asString(candidate.name, translator()('profile.importedName'));
  // Kimlik isim üzerinden: aynı dosyayı ikinci kez yüklemek kopya üretmemeli.
  const existing = settingsStore.get().profiles.find((entry) => entry.name === name);

  const profile: Profile = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    defaultPolicy: candidate.defaultPolicy === 'pass' ? 'pass' : 'block',
    domains: asDomainList(candidate.domains),
    allow: asPathList(candidate.allow),
    block: asPathList(candidate.block),
    fault: (candidate.fault as FaultConfig | undefined) ?? settingsStore.get().fault,
    updatedAt: Date.now(),
  };

  const others = settingsStore.get().profiles.filter((entry) => entry.id !== profile.id);
  await settingsStore.update({ profiles: [...others, profile] });
  return { ok: true, data: { id: profile.id } };
};
```

`applyProfile` içinde `rules: profile.rules` satırını değiştir:

```ts
    rules: profileToRules(profile, Date.now()),
```

`domains` satırı da string listesinden `DomainScope`'a döner:

```ts
    domains: profile.domains.length
      ? profile.domains.map((pattern) => ({ id: crypto.randomUUID(), pattern }))
      : current.domains,
```

`granted` **yazılmaz** — yerel izin `syncPermissions` ile ayrıca ölçülür.

`src/core/i18n.ts` — hata metnini güncelle:
- EN: `'error.profile-schema': 'Does not match the profile schema (no allow or block list).'`
- TR: `'error.profile-schema': 'Profil şemasına uymuyor (allow veya block listesi yok).'`

- [ ] **Adım 8: Testi çalıştır, geçtiğini gör**

Çalıştır: `npx vitest run src/background/service-worker.spec.ts`
Beklenen: PASS

- [ ] **Adım 9: Envanterin profil etiketini yeni kaynağa bağla**

`src/ui/components/inventory.ts` içinde `syncProfileKeys`:

```ts
  const syncProfileKeys = (): void => {
    const settings = state?.settings;
    const active = settings?.profiles.find((entry) => entry.id === settings.activeProfileId);
    profileKeys = new Set([...(active?.allow ?? []), ...(active?.block ?? [])]);
  };
```

`inventory.spec.ts` içindeki `profile()` fixture'ını yeni `Profile` şekline çevir (`rules` yerine `allow`/`block`, `domains: []`).

- [ ] **Adım 10: Tam doğrulama**

Çalıştır: `npm run verify`
Beklenen: yeşil

- [ ] **Adım 11: Commit**

```bash
git add -A
git commit -m "feat: profil dosyasını allow/block path listelerine indir"
```

---

## Görev 5: Preset üretimi

**Dosyalar:**
- Değiştir: `scripts/build-preset.mjs`
- Yeniden üret: `src/presets/dr-odeme-ve-satin-alma.json`, `src/presets/dr-hesap-mesaj-icerik.json`, `src/presets/dr-fatura-sozlesme-raporlama.json`

- [ ] **Adım 1: Kaynak listeyi ikiliye indir**

`scripts/build-preset.mjs` içindeki `PRESETS[].rows` girdilerinden **method'u sil**: `['POST', '/carts/offer', FULL]` → `['/carts/offer', FULL]`. Üç preset için de yap. `FULL` / `PARTIAL` sabitleri kaynak listede kalır — hangi endpoint'in tam, hangisinin kısmi kapatıldığı bilgisi okuyucu için değerlidir; çıktıya girmez.

- [ ] **Adım 2: Üreticiyi yeni biçime çevir**

`toPresetRule` fonksiyonunu sil, yerine path normalizasyonu + tekilleştirme koy:

```js
// §C.2: {param} → :id. Method yok (Revizyon 59): bir path'in tek durumu vardır.
// Bu üç senaryonun hepsi defaultPolicy "pass" + hepsi block olduğu için çıktı
// yalnızca `block` listesi taşır; `allow` boş kalır.
const toPath = (path) => path.replace(/\{[^}]+\}/g, ':id');

const buildPreset = (preset) => ({
  name: preset.name,
  defaultPolicy: 'pass',
  domains: [],
  allow: [],
  block: [...new Set(preset.rows.map(([path]) => toPath(path)))],
  fault: FAULT,
});
```

`id` ve `updatedAt` çıktıdan çıkar — dosya biçimi bunları taşımıyor. `FAULT` sabiti `scripts/build-preset.mjs:213`'te zaten tanımlı, olduğu gibi kullanılır.

- [ ] **Adım 3: Preset'leri yeniden üret**

Çalıştır: `npm run preset`
Beklenen: üç dosya da yeniden yazılır

- [ ] **Adım 4: Çıktıyı doğrula**

Çalıştır:

```bash
python3 -c "
import json, glob
for f in sorted(glob.glob('src/presets/*.json')):
    d = json.load(open(f))
    assert set(d) == {'name','defaultPolicy','domains','allow','block','fault'}, (f, list(d))
    assert d['allow'] == []
    assert len(d['block']) == len(set(d['block'])), f'{f}: tekrar var'
    assert all(p.startswith('/') and '{' not in p for p in d['block']), f
    print(f, len(d['block']), 'path')
"
```

Beklenen: üç satır, hata yok. Path sayıları **tam olarak** şunlar olmalı (mevcut kuralların tekilleştirilmiş hâli):

```
src/presets/dr-fatura-sozlesme-raporlama.json 48 path
src/presets/dr-hesap-mesaj-icerik.json 35 path
src/presets/dr-odeme-ve-satin-alma.json 59 path
```

Başka bir sayı çıkarsa `toPath` normalizasyonu ya da tekilleştirme yanlış — devam etme.

- [ ] **Adım 5: Bir preset'i gerçekten içe aktarabildiğini doğrula**

`src/background/service-worker.spec.ts` içine:

```ts
    it('depodaki preset dosyası olduğu gibi içe aktarılır', async () => {
      const preset = await import('../../presets/dr-odeme-ve-satin-alma.json');
      const result = await run(COMMANDS.IMPORT_PROFILE, { json: JSON.stringify(preset.default) });

      expect(result.ok).toBe(true);
      expect(buildState(null).settings.profiles[0]?.block.length).toBeGreaterThan(50);
    });
```

Çalıştır: `npx vitest run src/background/service-worker.spec.ts`
Beklenen: PASS

- [ ] **Adım 6: Tam doğrulama**

Çalıştır: `npm run verify`
Beklenen: yeşil

- [ ] **Adım 7: Commit**

```bash
git add -A
git commit -m "chore: preset'leri yeni profil biçiminde yeniden üret"
```

---

## Görev 6: Kılavuz dokümanları

**Dosyalar:**
- Değiştir: `docs/guide.md`, `docs/guide.tr.md` (örnek profil + profil alanları bölümleri)
- Değiştir: `docs/sample-profile.json`

- [ ] **Adım 1: Örnek profil dosyasını yeni biçime çevir**

`docs/sample-profile.json`:

```json
{
  "name": "Örnek — ödeme kapalı",
  "defaultPolicy": "block",
  "domains": ["api.example.com"],
  "allow": ["/users/current", "/orders/:id/detail"],
  "block": ["/payments/checkout"],
  "fault": {
    "kind": "http",
    "status": 503,
    "statusText": "Service Unavailable",
    "body": "{\"message\":\"DR simulated unavailable\"}",
    "headers": {},
    "delayMs": 0,
    "timeoutMs": 30000
  }
}
```

İngilizce dosyada `"name": "Sample — payment closed"` kullan.

- [ ] **Adım 2: Kılavuzlardaki JSON bloğunu değiştir**

Her iki kılavuzda `## Örnek profil` / `## Sample profile` başlığı altındaki ```json bloğunu Adım 1'deki içerikle değiştir.

- [ ] **Adım 3: Profil alanları tablolarını yeniden yaz**

Her iki kılavuzda `## Profil alanları` / `## Profile fields` bölümünde şu an **dört** grup var (`docs/guide.tr.md:187-225`):
`{ … }`, `rules[]`, `domains[]`, `fault`.

Bunlar **ikiye** iner: `rules[]` ve `domains[]` gruplarını tamamen sil — kural artık ayrı bir nesne değil, `domains` da düz string dizisi; ikisi de kök tabloda tek satırla anlatılıyor. Geriye kök alanlar ve `fault` kalır. `fault` grubunun tablosu olduğu gibi korunur.

Türkçe kök tablo:

```markdown
### `{ … }` — Kök alanlar

Dosyanın tamamı bu kadardır. Zorunlu olan tek şey `allow` veya `block` listelerinden en az birinin bulunmasıdır.

| Alan | Tip | Zorunlu | Anlamı |
| --- | --- | --- | --- |
| `allow` | string dizisi | biri zorunlu | Normal çalışacak path'ler. Method yazılmaz: bir path'in kuralı o path'in bütün method'ları için geçerlidir. |
| `block` | string dizisi | biri zorunlu | Arıza dönecek path'ler. Bir path iki listede birden geçerse `block` kazanır. |
| `name` | metin | hayır | Panelin profil listesinde görünen ad. Aynı isimli bir profil varsa üzerine yazılır — aynı dosyayı ikinci kez yüklemek kopya üretmez. |
| `defaultPolicy` | `"block"` \| `"pass"` | hayır | İki listede de olmayan path'lere ne olacağı. Tanınmayan değer `"block"` sayılır. |
| `domains` | string dizisi | hayır | Profille gelen domain kapsamı, örneğin `["api.sirket.com"]`. Boş bırakırsan mevcut domainlerin korunur. Site izni her zaman yerelde sorulur; dosya izin taşımaz. |
| `fault` | nesne | hayır | Engellenen isteklerin nasıl başarısız olacağı. Verilmezse mevcut arıza ayarın korunur. |

Path'ler normalize edilmiş yazılır: değişken segmentler `:id` olur — `/orders/8842/detail` değil, `/orders/:id/detail`. Joker (`*`) desteklenmez; geçersiz bir path sessizce atlanır, dosyanın kalanı yüklenir.
```

`docs/guide.md` içindeki İngilizce karşılığı:

```markdown
### `{ … }` — Top-level fields

This is the whole file. The only requirement is that at least one of the `allow` or `block` lists is present.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `allow` | string array | one of the two | Paths that keep working normally. No method is written: a rule for a path applies to every method of that path. |
| `block` | string array | one of the two | Paths that return a fault. If a path appears in both lists, `block` wins. |
| `name` | text | no | The name shown in the panel's profile list. If a profile with the same name exists it is overwritten — importing the same file twice does not create a copy. |
| `defaultPolicy` | `"block"` \| `"pass"` | no | What happens to paths in neither list. An unrecognised value counts as `"block"`. |
| `domains` | string array | no | The domain scope shipped with the profile, e.g. `["api.company.com"]`. Leave it empty to keep your current domains. Site permission is always asked for locally; the file carries no permission. |
| `fault` | object | no | How blocked requests fail. If omitted, your current fault setting is kept. |

Paths are written normalized: variable segments become `:id` — `/orders/:id/detail`, not `/orders/8842/detail`. Wildcards (`*`) are not supported; an invalid path is skipped silently and the rest of the file still loads.
```

- [ ] **Adım 4: İçindekiler ve bağlantıları doğrula**

Çalıştır:

```bash
python3 - <<'PY'
import pathlib, re, unicodedata

def gh_slug(title):
    out = []
    for ch in title.lower().strip():
        if ch in '-_' or ch == ' ' or unicodedata.category(ch)[0] in ('L', 'N', 'M'):
            out.append(ch)
    return ''.join(out).replace(' ', '-')

problems = []
for path in ['docs/guide.md', 'docs/guide.tr.md']:
    text = pathlib.Path(path).read_text()
    heads = {gh_slug(m.group(1).strip()) for m in re.finditer(r'^##+ (.+)$', text, re.M)}
    for m in re.finditer(r'\]\(#([^)]+)\)', text):
        if m.group(1) not in heads:
            problems.append(f'{path}: #{m.group(1)}')
print('\n'.join(problems) if problems else 'çapalar tamam')
PY
```

Beklenen: `çapalar tamam`

- [ ] **Adım 5: Örnek dosyanın gerçekten geçerli olduğunu doğrula**

`docs/sample-profile.json` yeni şemadan geçmeli. Çalıştır:

```bash
python3 -c "
import json
d = json.load(open('docs/sample-profile.json'))
assert isinstance(d.get('allow'), list) or isinstance(d.get('block'), list)
assert 'rules' not in d and 'id' not in d and 'updatedAt' not in d
print('örnek dosya şemaya uyuyor')
"
```

- [ ] **Adım 6: Commit**

```bash
git add -A
git commit -m "docs: kılavuzu yeni profil biçimine göre güncelle"
```

---

## Kapanış

- [ ] **Son doğrulama:** `npm run verify` yeşil
- [ ] **Spec durumunu güncelle:** `docs/specs/2026-08-14-profil-formati-sadelestirme.md` başındaki `**Durum:**` satırını `uygulandı — <commit>` yap ve commit et
- [ ] Kullanıcıya push için sor
