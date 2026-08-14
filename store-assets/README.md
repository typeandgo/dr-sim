# Mağaza görselleri

Bu klasördeki PNG'ler **elle düzenlenmez**; `npm run store:assets` ile yeniden üretilir.

```bash
npm run build          # dist/ güncel olmalı — panel görselleri oradan render edilir
npm run store:assets   # tümü
npm run store:assets -- loop marquee   # yalnızca seçilenler
```

## Hangi dosya nereye

| Dosya | Boyut | Chrome Web Store alanı |
| --- | --- | --- |
| `01-simulate-failures.png` | 1280×800 | Screenshot 1 — listelemede en önde çıkan kare |
| `02-live-inventory.png` | 1280×800 | Screenshot 2 |
| `03-fault-and-normalization.png` | 1280×800 | Screenshot 3 |
| `04-profiles-and-reports.png` | 1280×800 | Screenshot 4 |
| `05-privacy-and-permissions.png` | 1280×800 | Screenshot 5 (mağaza en fazla 5 kabul eder) |
| `cover-small-tile-440x280.png` | 440×280 | Small promo tile |
| `cover-marquee-1400x560.png` | 1400×560 | Marquee promo tile |

İkon (128×128) ayrıca yüklenmez; manifest'ten gelir.

## Görsellerdeki veri gerçektir

Tezgâh sahte bir arayüz çizmez. Her karede:

- Panel ve ayarlar sayfası `dist/` içindeki **gerçek** derlenmiş arayüzdür; yalnızca `chrome.*` yüzeyi taklit edilir (`scripts/store-assets/pages.mjs`).
- Yanındaki demo uygulama DR-SIM'in **gerçek** interceptor'ını (`dist/content/interceptor.main.js`) yükler ve gerçek `RuntimeConfig` ile besler. Kırmızıya dönen kart, isteğin gerçekten kesildiği anlamına gelir.
- Envanter, loglar ve süreler ürünün **kendi** oturum deposundan (`createSessionStore`) geçen gerçek telemetriyle üretilir.
- `04`'teki `dr-sim-report.md` önizlemesi `buildResultReport` çıktısıdır — "Rapor MD" düğmesinin indireceği dosyanın aynısı.

Yani ekranda görünen 503'ler, `ms` süreleri ve EP sayıları uydurma değildir.

## Notlar

- Kareler 2× çözünürlükte alınıp `sips` ile ölçeğe indirilir; metin 1280×800'de keskin kalır.
- Arayüz dili İngilizcedir (manifest `default_locale: en`).
- Üretim sırasında `7174`, `7175` ve `7180` portları kullanılır; doluysa tezgâh hata verip durur.
- Senaryo metinleri ve kural listeleri `scripts/store-assets/scenes.mjs` içindedir.
