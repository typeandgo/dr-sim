import type { Locale } from '@/core/i18n';

// Profil JSON'ının alan sözlüğü — Ayarlar → Örnek profil bölümünün altında durur.
//
// `guide.ts` ile aynı gerekçe: metin uzun ve yalnızca options sayfasına lazım,
// bu yüzden `core/i18n.ts` sözlüğüne KONMADI (orası service worker'a da bundle
// ediliyor).
//
// SENKRON GARANTİSİ: `profile-fields.spec.ts`, buradaki anahtar listesini örnek
// profilin GERÇEK JSON çıktısıyla karşılaştırır. Şemaya alan eklenip buraya
// yazılmazsa (veya tersi) test kırılır — doküman şemadan sessizce ayrışamaz.

export interface FieldRow {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

export interface FieldGroup {
  // `rules[]` gibi, alanın JSON içindeki yeri
  path: string;
  title: string;
  intro: string;
  rows: FieldRow[];
}

const TR: FieldGroup[] = [
  {
    path: '{ … }',
    title: 'Kök alanlar',
    intro: 'Dosyanın en dış katmanı. İçe aktarmanın zorunlu tuttuğu tek alan “rules” listesidir; kalanı eksikse mevcut ayarların ya da varsayılanların yerini korur.',
    rows: [
      {
        name: 'rules',
        type: 'dizi',
        required: true,
        desc: 'Kural kayıtları. Profilin asıl içeriği budur; boş dizi de geçerlidir ama o zaman profil hiçbir şey değiştirmez.',
      },
      {
        name: 'name',
        type: 'metin',
        required: false,
        desc: 'Panelin profil listesinde görünen ad. Boş bırakılırsa arayüz dilinde bir yedek ad atanır. Dışa aktarılan dosyanın adı da bundan türer.',
      },
      {
        name: 'defaultPolicy',
        type: '"block" | "pass"',
        required: false,
        desc: 'Hakkında kural yazılmamış EP’lere ne olacağı. "block" → listede olmayan her şey arıza döner. "pass" → yalnızca tek tek engellediklerin arıza döner. Tanınmayan değer "block" sayılır.',
      },
      {
        name: 'domains',
        type: 'dizi',
        required: false,
        desc: 'Profille birlikte gelen domain kapsamı. Boş dizi verirsen profil uygulanırken mevcut domainlerin korunur — paylaşılan bir profilin senin kapsamını silmemesi için.',
      },
      {
        name: 'fault',
        type: 'nesne',
        required: false,
        desc: 'Engellenen isteklerin nasıl başarısız olacağı. Verilmezse mevcut arıza ayarın korunur.',
      },
      {
        name: 'id',
        type: 'metin',
        required: false,
        desc: 'Profilin kimliği. Aynı id ile ikinci kez içe aktarırsan eskisinin üzerine yazılır. Boş bırakırsan yeni bir kimlik üretilir — elle yazmana genelde gerek yoktur.',
      },
      {
        name: 'updatedAt',
        type: 'sayı',
        required: false,
        desc: 'Son değişiklik zamanı (Unix ms). İçe aktarırken yok sayılır ve o anki zamanla değiştirilir; elle 0 bırakabilirsin.',
      },
    ],
  },
  {
    path: 'rules[]',
    title: 'Kural kaydı',
    intro: 'Her kayıt tek bir EP’nin durumunu belirtir. Joker desteklenmez: bir EP’nin tek bir durumu vardır, öncelik ya da çakışma mantığı yoktur.',
    rows: [
      {
        name: 'key',
        type: 'metin',
        required: true,
        desc: 'Birincil anahtar; “METHOD /path” biçiminde ve tam olarak `method` + boşluk + `path` olmalıdır. Eşleşme bunun üzerinden yapılır, iki alanla tutarsız bir key kuralı ulaşılmaz kılar.',
      },
      {
        name: 'method',
        type: 'metin',
        required: true,
        desc: 'HTTP metodu, büyük harf: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.',
      },
      {
        name: 'path',
        type: 'metin',
        required: true,
        desc: 'Normalize edilmiş yol. Değişken segmentler :id ile yazılır — /orders/8842/detail değil, /orders/:id/detail. Ham id bırakırsan kural yalnızca o tek kayda uyar ve pratikte hiç eşleşmez.',
      },
      {
        name: 'state',
        type: '"allow" | "block"',
        required: true,
        desc: '"allow" → istek gerçek backend’e gider. "block" → istek kesilir ve seçili arıza döner.',
      },
      {
        name: 'source',
        type: '"inventory" | "manual" | "preset" | "quick-allow"',
        required: false,
        desc: 'Kaydın nereden geldiği; yalnızca bilgi amaçlıdır, karara etkisi yoktur. Elle yazılan profillerde "preset" uygun bir seçimdir.',
      },
      {
        name: 'note',
        type: 'metin',
        required: false,
        desc: 'Serbest açıklama — “giriş için gerekli, açık kalmalı” gibi. Profili paylaşırken kararın gerekçesini taşımanın en kolay yolu.',
      },
      {
        name: 'createdAt',
        type: 'sayı',
        required: false,
        desc: 'Kaydın oluşturulma zamanı (Unix ms). Elle yazarken 0 bırakabilirsin.',
      },
    ],
  },
  {
    path: 'domains[]',
    title: 'Domain kapsamı',
    intro: 'Hangi isteklerin yönetileceğini seçer; yani API host’unu. Bu listede olmayan hiçbir isteğe dokunulmaz.',
    rows: [
      {
        name: 'pattern',
        type: 'metin',
        required: true,
        desc: 'Host, isteğe bağlı bir alt yol ile: api.example.com, *.example.com, api.example.com/gw. Protokol yazma. Port yazabilirsin (localhost:5175) — istek eşleşmesinde korunur.',
      },
      {
        name: 'id',
        type: 'metin',
        required: false,
        desc: 'Kayıt kimliği. Elle yazarken kısa bir değer yeterlidir; benzersiz olması dışında bir anlamı yoktur.',
      },
      {
        name: 'granted',
        type: 'true | false',
        required: false,
        desc: 'Host izninin verilip verilmediği. Bu alan dosyadan okunmaz, uygulanırken tarayıcının gerçek izin durumuna göre yeniden hesaplanır — profil paylaşarak izin taşınamaz.',
      },
    ],
  },
  {
    path: 'fault',
    title: 'Arıza ayarı',
    intro: 'Engellenen her istek bu şekilde başarısız olur. Ayar globaldir: kural bazlı ayrı arıza yoktur.',
    rows: [
      {
        name: 'kind',
        type: '"http" | "network" | "timeout"',
        required: true,
        desc: '"http" → seçtiğin durum koduyla yanıt döner. "network" → istek ağ hatasıyla düşer (sunucuya hiç ulaşılamamış gibi). "timeout" → yanıt hiç gelmez, süre dolunca zaman aşımına düşer.',
      },
      {
        name: 'status',
        type: 'sayı',
        required: true,
        desc: 'HTTP durum kodu — 503, 500, 429 gibi. Yalnızca kind "http" iken kullanılır.',
      },
      {
        name: 'statusText',
        type: 'metin',
        required: true,
        desc: 'Durum metni, örneğin "Service Unavailable". Yalnızca kind "http" iken kullanılır.',
      },
      {
        name: 'body',
        type: 'metin',
        required: true,
        desc: 'Yanıt gövdesi; JSON göndermek istiyorsan JSON’un kendisini METİN olarak yaz. Geçerli JSON ise content-type application/json, değilse düz metin olarak döner.',
      },
      {
        name: 'headers',
        type: 'nesne',
        required: true,
        desc: 'Yanıta eklenecek ek başlıklar. Boş nesne ({}) olağan durumdur. Simüle yanıtlara her hâlükârda bir x-drsim-simulated başlığı eklenir.',
      },
      {
        name: 'delayMs',
        type: 'sayı',
        required: true,
        desc: 'Arıza dönmeden önce beklenecek süre (ms). Yavaş servis taklidi için kullanılır; 0 anında yanıt demektir.',
      },
      {
        name: 'timeoutMs',
        type: 'sayı',
        required: true,
        desc: 'Zaman aşımına düşmeden önce beklenecek süre (ms). Yalnızca kind "timeout" iken kullanılır.',
      },
    ],
  },
];

const EN: FieldGroup[] = [
  {
    path: '{ … }',
    title: 'Top-level fields',
    intro: 'The outermost layer of the file. The only field the import requires is the “rules” list; anything missing keeps your current settings or the defaults.',
    rows: [
      {
        name: 'rules',
        type: 'array',
        required: true,
        desc: 'The rule records. This is the actual content of a profile; an empty array is valid but then the profile changes nothing.',
      },
      {
        name: 'name',
        type: 'string',
        required: false,
        desc: 'The name shown in the panel’s profile list. If left empty a fallback name in the interface language is assigned. The exported file name is derived from it too.',
      },
      {
        name: 'defaultPolicy',
        type: '"block" | "pass"',
        required: false,
        desc: 'What happens to endpoints you wrote no rule for. "block" → everything not on the list fails. "pass" → only the ones you explicitly blocked fail. An unrecognised value is treated as "block".',
      },
      {
        name: 'domains',
        type: 'array',
        required: false,
        desc: 'The domain scope shipped with the profile. If you pass an empty array your current domains are kept when the profile is applied — so a shared profile cannot wipe your scope.',
      },
      {
        name: 'fault',
        type: 'object',
        required: false,
        desc: 'How blocked requests fail. If omitted, your current fault setting is kept.',
      },
      {
        name: 'id',
        type: 'string',
        required: false,
        desc: 'The profile identity. Importing twice with the same id overwrites the earlier one. Leave it out and a new identity is generated — you rarely need to write it by hand.',
      },
      {
        name: 'updatedAt',
        type: 'number',
        required: false,
        desc: 'Last change time (Unix ms). Ignored on import and replaced with the current time; you can leave it at 0.',
      },
    ],
  },
  {
    path: 'rules[]',
    title: 'Rule record',
    intro: 'Each record sets the state of exactly one endpoint. Wildcards are not supported: an endpoint has one single state, there is no precedence or conflict logic.',
    rows: [
      {
        name: 'key',
        type: 'string',
        required: true,
        desc: 'The primary key, written as “METHOD /path” — it must be exactly `method` + a space + `path`. Matching runs on this, so a key inconsistent with the other two fields makes the rule unreachable.',
      },
      {
        name: 'method',
        type: 'string',
        required: true,
        desc: 'HTTP method in upper case: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.',
      },
      {
        name: 'path',
        type: 'string',
        required: true,
        desc: 'The normalized path. Variable segments are written as :id — not /orders/8842/detail but /orders/:id/detail. Leaving a raw id in matches that single record only, so in practice it never matches.',
      },
      {
        name: 'state',
        type: '"allow" | "block"',
        required: true,
        desc: '"allow" → the request reaches the real backend. "block" → the request is intercepted and the selected fault is returned.',
      },
      {
        name: 'source',
        type: '"inventory" | "manual" | "preset" | "quick-allow"',
        required: false,
        desc: 'Where the record came from; informational only, it does not affect the decision. "preset" is a sensible choice for hand-written profiles.',
      },
      {
        name: 'note',
        type: 'string',
        required: false,
        desc: 'A free-form comment — “needed for login, must stay open”. The easiest way to carry the reasoning along when you share a profile.',
      },
      {
        name: 'createdAt',
        type: 'number',
        required: false,
        desc: 'When the record was created (Unix ms). You can leave it at 0 when writing by hand.',
      },
    ],
  },
  {
    path: 'domains[]',
    title: 'Domain scope',
    intro: 'Selects which requests are managed — that is, the API host. Nothing outside this list is ever touched.',
    rows: [
      {
        name: 'pattern',
        type: 'string',
        required: true,
        desc: 'A host with an optional base path: api.example.com, *.example.com, api.example.com/gw. Do not write the protocol. A port is allowed (localhost:5175) and is preserved when matching requests.',
      },
      {
        name: 'id',
        type: 'string',
        required: false,
        desc: 'Record identity. A short value is enough when writing by hand; it means nothing beyond being unique.',
      },
      {
        name: 'granted',
        type: 'true | false',
        required: false,
        desc: 'Whether host access was granted. This field is not read from the file — it is recomputed from the browser’s real permission state, so permissions cannot travel inside a shared profile.',
      },
    ],
  },
  {
    path: 'fault',
    title: 'Fault setting',
    intro: 'Every blocked request fails this way. The setting is global: there is no per-rule fault.',
    rows: [
      {
        name: 'kind',
        type: '"http" | "network" | "timeout"',
        required: true,
        desc: '"http" → a response with the status code you chose. "network" → the request fails at the network level (as if the server was never reached). "timeout" → no response ever arrives and the request times out.',
      },
      {
        name: 'status',
        type: 'number',
        required: true,
        desc: 'HTTP status code — 503, 500, 429 and so on. Used only when kind is "http".',
      },
      {
        name: 'statusText',
        type: 'string',
        required: true,
        desc: 'The status text, e.g. "Service Unavailable". Used only when kind is "http".',
      },
      {
        name: 'body',
        type: 'string',
        required: true,
        desc: 'The response body; if you want to return JSON, write the JSON itself AS A STRING. Valid JSON is served as application/json, anything else as plain text.',
      },
      {
        name: 'headers',
        type: 'object',
        required: true,
        desc: 'Extra headers added to the response. An empty object ({}) is the usual case. Simulated responses always carry an x-drsim-simulated header regardless.',
      },
      {
        name: 'delayMs',
        type: 'number',
        required: true,
        desc: 'How long to wait before returning the fault (ms). Useful for imitating a slow service; 0 means respond immediately.',
      },
      {
        name: 'timeoutMs',
        type: 'number',
        required: true,
        desc: 'How long to wait before timing out (ms). Used only when kind is "timeout".',
      },
    ],
  },
];

export const PROFILE_FIELDS: Record<Locale, FieldGroup[]> = { tr: TR, en: EN };
