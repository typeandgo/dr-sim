# Profil formatını sadeleştirme — tasarım

**Tarih:** 2026-08-14
**Durum:** uygulandı — dal `refactor/profil-formati`, `2573ad8..07d23f6`

## Sorun

Profil dosyasındaki `rules[]` girdileri yedi alan taşıyor (`key`, `method`, `path`, `state`, `source`, `note`, `createdAt`). Elle yazılabilir olması gereken bir dosya için bu fazla kalabalık; 50 endpoint'lik bir profil 350 satır JSON demek.

Kalabalığın büyük kısmı gerçek bir iş görmüyor:

- **`key`** — `method` + boşluk + `path`'in kopyası. İkisiyle tutarsız yazılırsa kural sessizce ulaşılmaz oluyor; `importProfile` bunu doğrulamıyor.
- **`note`** — `rules.ts:45`'te yazılıyor, **hiçbir yerde ekrana basılmıyor**. Üç preset'te 150 adet kullanılmayan metin var.
- **`source`** — dört çağrı noktasında yazılıyor, **hiçbir yerde okunmuyor**; tek işlevi kendini bir sonraki `upsertRule`'a taşımak.
- **`createdAt`** — import'ta anlamsız, hep 0 yazılıyor.
- **`method`** — üç preset'te 150 kural, 142 farklı path var. Yalnızca 7 path'te birden fazla method geçiyor ve **hiçbirinde iki method farklı duruma sahip değil**. Yani method kırılımı hiç kullanılmamış.

Ayrıca `domains` alanı `{id, pattern, granted}` nesneleri taşıyor. `granted` **makineye özel izin durumu**: dışa aktarılan profil karşı tarafa `granted: true` götürüyor, `activeDomainPatterns` da `granted !== false` diye filtrelediği için o domain, yerel izin hiç verilmemişken aktif sayılıyor. `syncPermissions` bunu ancak bir sonraki izin olayında düzeltiyor — arada bir pencere var.

## Kararlar

| Karar | Seçim | Gerekçe |
|---|---|---|
| Kapsam | Method'suz eşleşme **tüm modele** iner; EP artık path demek | Dosya ile iç model aynı dili konuşur, çeviri katmanı olmaz |
| Envanter | **Path başına tek satır**, çağrılan method'lar etiket | Her satır tam olarak bir kurala karşılık gelir; toggle'ın neyi çevirdiği belirsiz kalmaz |
| Eski dosyalar | **Temiz kırılma** — `rules[]` içeren dosya reddedilir | Tek okuma yolu, uyumluluk dalı yok |
| İsimlendirme | `allow` / `block` | Dosya kural tanımlıyor; success/fail üründe *gözlem* sözlüğü (Son Success'ler / Son Fail'ler). İkisini karıştırmak gözlem ≠ simülasyon ayrımını bulandırır |
| `domains` | String dizisi | `granted` sızıntısını kökten kapatır |

## Yeni dosya formatı

```json
{
  "name": "DR — Ödeme ve satın alma",
  "defaultPolicy": "pass",
  "domains": ["api.sirket.com"],
  "allow": ["/users/current", "/orders/:id/detail"],
  "block": ["/payments/checkout", "/invoices"],
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

### Şema kuralları

- **Geçerlilik koşulu:** `allow` veya `block`'tan en az biri dizi olmalı. Değilse `profile-schema` hatası. Eski `rules[]` dosyaları da tam buradan reddolur — ayrı bir kontrol gerekmez.
- `allow` / `block`: string dizisi. Her eleman `validateRulePath`'ten geçer (boş olamaz, `*` içeremez, `/` olamaz) ve `normalizePath` ile normalize edilir. Geçersiz eleman **atlanır**, dosyanın tamamı reddedilmez.
- Aynı path iki listede de varsa **`block` kazanır**. DR aracında güvenli taraf kesmektir. Bu çözüm tek bir yerde tanımlanır ve import, migration ve preset üretiminde aynı fonksiyon kullanılır.
- `name`: yoksa `profile.importedName` yedeği.
- `defaultPolicy`: `"pass"` dışındaki her değer `"block"` sayılır (mevcut davranış).
- `domains`: string dizisi; her eleman `validateDomainPattern`'den geçer, geçersizler atlanır. Import ederken `granted` **yazılmaz** — yerel izin ayrıca sorulur.
- `fault`: verilmezse mevcut arıza ayarı korunur (mevcut davranış).
- **Dosyada `id` ve `updatedAt` yok.** Kimlik `name` üzerinden: aynı isimli profil varsa üzerine yazılır, yoksa eklenir. "Aynı dosyayı tekrar yükledim, ikinci kopya oluşmadı" davranışı korunur.

## Profile nesnesi ve serileştirme

Kritik ayrım: **`Profile` nesnesi dosyanın şeklini birebir taşır**, `Rule[]` taşımaz.

```ts
interface Profile {
  id: string;            // yerel defter — dosyaya YAZILMAZ
  name: string;
  defaultPolicy: DefaultPolicy;
  domains: string[];
  allow: string[];
  block: string[];
  fault: FaultConfig;
  updatedAt: number;     // yerel defter — dosyaya YAZILMAZ
}
```

Gerekçe: "Seçili profil **aynen** dışa aktarılır" sözleşmesi (Revizyon 31) korunuyor. Profile içeride `Rule[]` tutsaydı hem yazarken hem okurken çeviri gerekir, iki çeviri arasında ayrışma riski doğardı. Bu şekilde tek çeviri noktası var:

| Yön | Nerede | Ne yapar |
|---|---|---|
| Profile → dosya | `buildProfileFile` | `id` ve `updatedAt` alanlarını **ayıklar**, kalanı `JSON.stringify` |
| dosya → Profile | `importProfile` | doğrular, `id` üretir/eşleştirir, `updatedAt = Date.now()` |
| Profile → Settings | `applyProfile` | `allow`/`block` dizilerini `Rule[]`'a çevirir |
| Settings → Profile | `snapshotProfile` | `Rule[]`'ı `allow`/`block` dizilerine ayırır |

`applyProfile` üretilen kurallara `createdAt: Date.now()` yazar — dosyada zaman bilgisi yok, "bu kural ne zaman listeme girdi" sorusunun yerel cevabı budur.

Envanterdeki "profil" etiketi `active.rules` yerine `[...active.allow, ...active.block]` üzerinden bakar.

## İç model

```ts
// önce
interface Rule { key, method, path, state, source, note?, createdAt }

// sonra
interface Rule { path: string; state: RuleState; createdAt: number }
```

- `Rule.key` kalkar — `path` zaten birincil anahtar.
- `toEndpointKey` (`path.util.ts`) kalkar. `normalizeMethod` kalır: gözlem tarafı (envanter etiketleri, loglar, raporlar) method'u göstermeye devam ediyor.
- `RuleSource` tipi ve `RuleInput.source` / `RuleInput.note` kalkar.
- `decide()` içinde `key = path`; method karara hiç girmez. `Decision.method` **kalır** — telemetri ve loglar kullanıyor.
- `compileRules` çıktısı `Record<path, RuleState>`.
- `COMMANDS.SET_RULE_STATE` payload'ı `{ path, state }`, `TOGGLE_RULE_STATE` payload'ı `{ path }` olur.

### Envanter

```ts
interface InventoryItem {
  key: string;          // = path
  path: string;
  methods: HttpMethod[]; // gözlemlenen method'lar, ilk görülme sırasına göre
  // method alanı kalkar; kalan alanlar aynı
}
```

`upsertInventory` path'e anahtarlar, `methods` listesine yeni method'u ekler, sayaçları toplar. Satır `/orders` yazar; method'lar `xhr` / `profil` etiketlerinin yanında birer etiket olarak görünür.

`session.store` verisi `chrome.storage.session`'da yaşıyor ve `startDocument` her sayfa yüklemesinde envanteri sıfırlıyor; ayrıca bir session migration'ına gerek yok. `hydrate()` eski şekilli bir kayıt okursa `methods` alanı boş kalır — satır yine çizilir, ilk telemetride düzelir.

## Depolanan ayarlar: göç yok, sıfırlama var

`SCHEMA_VERSION` 5. **Göç zinciri kaldırıldı** (Revizyon 60, ürün kararı): profil biçimi son hâliyle sabit, önceki biçimler desteklenmiyor.

`normalizeSettings` depodaki kaydın `schemaVersion`'ı güncel değilse — eski, ileri ya da hiç yok — kaydı onarmaya çalışmaz, **tamamen atar** ve varsayılanlara döner. Eski sürümden güncelleme alan kullanıcı domainlerini, kurallarını, profillerini ve tüm ayarlarını kaybeder; her şeye son biçimle sıfırdan başlar.

Sıfırlama sessiz değil: `load()` bu durumda `settings-reset` bildirimi kurar ve panel bunu bir kez gösterir (`error.settings-reset`, iki dilde).

Bunun bedeli bilinçli olarak kabul edildi. Alternatif, her şema değişikliğinde geriye dönük bir dönüşüm yolunu daha doğru tutmak ve test etmekti; ürün bu yükü taşımak istemiyor.

## Preset'ler

`scripts/build-preset.mjs` içindeki satırlar `[METHOD, path, severity]` üçlüsünden `[path, severity]` ikilisine iner ve tekilleştirilir. Üç preset de `defaultPolicy: "pass"` + hepsi block olduğu için çıktı yalnızca `block` dizisi taşır; `allow` hiç yazılmaz. `severity` (FULL/PARTIAL) yalnızca `note` üretiyordu, `note` kalktığı için severity ayrımı da dosyadan çıkar — kaynak listedeki yorum satırları olarak kalır.

Beklenen küçülme: 61 kural × 7 alan → 59 path stringi.

```json
{
  "name": "DR — Ödeme ve satın alma",
  "defaultPolicy": "pass",
  "domains": [],
  "allow": [],
  "block": ["/carts/offer", "/carts/current", "…"],
  "fault": { "…": "…" }
}
```

## Kapsam dışı

- Joker (`*`) kural desteği — hâlâ reddediliyor (T-804 backlog).
- `normalization` ayarlarının profile taşınması — bugün de taşınmıyor, bu iş onu değiştirmiyor.
- Panelin allow/block sözlüğü (İzinli/Engelli) değişmiyor.

## Test planı

Mevcut desen korunur: DOM değil komut/payload doğrulanır, her modülün kendi spec'i olur.

| Dosya | Eklenecek/değişecek |
|---|---|
| `rules.spec.ts` | path-anahtarlı upsert/toggle/remove; method'suz çakışma yok |
| `decision-engine.spec.ts` | aynı path'in farklı method'ları aynı kararı alır |
| `compile-config.spec.ts` | `rulesByKey` path'e anahtarlı |
| `settings.store.spec.ts` | v5: birleştirme, block-kazanır, `createdAt` devri |
| `service-worker.spec.ts` | yeni şema kabulü; `rules[]` reddi; iki listede geçen path; geçersiz path'in atlanması; aynı isimle ikinci import üzerine yazar |
| `inventory.spec.ts` | path başına tek satır, method etiketleri, sayaç toplama |
| `profile.spec.ts` | `buildProfileFile` `id`/`updatedAt` ayıklar; `snapshotProfile` kuralları iki listeye ayırır |
| `report.builder.spec.ts` | satır biçimi |

## Dokunulacak dosyalar

`core/types.ts` · `core/path.util.ts` · `core/rules.ts` · `core/decision-engine.ts` · `core/compile-config.ts` · `core/profile.ts` · `core/report.builder.ts` · `core/constants.ts` (SCHEMA_VERSION) · `background/stores/settings.store.ts` · `background/stores/session.store.ts` · `background/service-worker.ts` · `ui/components/inventory.ts` · `ui/components/log-list.ts` · `ui/options/main.ts` · `scripts/build-preset.mjs` + `src/presets/*.json` (3) · `docs/guide.md` + `docs/guide.tr.md` (profil alanları bölümü) · ilgili spec dosyaları.


---

## Uygulama sonrası takip maddeleri

Dal tamamlandıktan sonra açık bırakılan, merge'i engellemeyen maddeler.

### Sürüm notuna girmeli

1.0.1 döneminde dışa aktarılmış profil dosyaları kural listesini kaybetmiş olabilir. v5 göçü depodaki ayar kaydını onarır ama indirilmiş dosyaları kurtaramaz — o dosyalar yeniden dışa aktarılmalı.

### Spec sapması

`decide()` içinde `key` hâlâ `` `${method} ${path}` `` olarak üretiliyor; spec `key = path` diyordu. `Decision.key` ve `TelemetryRecord.key` artık hiçbir yerde okunmuyor (envanter `record.path` ile anahtarlanıyor), ama `message.schema.ts` alanı zorunlu tutup her istekte MAIN→bridge→SW sınırından geçiriyor. Runtime etkisi yok, ölü yük.

### Ertelenen küçük maddeler

- `toggleRule` path'i iki kez normalize ediyor (`rules.ts`). `normalizePath` idempotent olduğu için zararsız; idempotentliği kaybederse sessiz bug olur.
- `build-preset.mjs` preset-**içi** path çakışmasını artık uyarmadan yutuyor (eskiden `console.warn` vardı). Kaynak listede gerçek bir mükerrer var (`/cart-items/{id}`), çıktı doğru ama veri girişi hatası diagnostic üretmiyor.
- `importProfile` `candidate.fault`'u doğrulamadan cast ediyor (pre-existing).
- `keepInventoryOnNavigate` açıkken, eski şemalı bir oturum envanteri hydrate edilirse aynı EP iki satır görünebilir. Sayfa yenilenince düzelir, tüm okumalar savunmacı.
- Kılavuz düz `xhr` etiketini hiç anlatmıyor (bu dalla gelmedi).

### Bilinçli karar: `buildProfileFile` savunmacı değil

`profile.allow`/`block` için `?? []` **eklenmedi**. Gerekçe: `importProfile`'ın kapısı iki liste de yoksa `profile-schema` ile gürültülü reddediyor. `?? []` eklenirse dosyaya boş listeler yazılır ve dosya başarıyla ama boş içe aktarılır — sessizlik hem dışa hem içe aktarmada sürer. Şekil garantisi migration ve import doğrulamasından geliyor.
