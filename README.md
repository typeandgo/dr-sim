# DR-SIM

Web uygulamalarında **hangi backend endpoint'lerinin çalışmadığını simüle eden** Chrome eklentisi (MV3). Hedef uygulamada tek satır kod değişikliği gerektirmez; `fetch` ve `XMLHttpRequest` üzerinden giden tüm JS kaynaklı trafiği kapsar.

Gizlilik politikası: [`PRIVACY.md`](./PRIVACY.md)

## Çekirdek kural modeli

Tek bir kural listesi vardır; her EP üç değerlidir:

| Durum | Davranış |
|---|---|
| `İzinli` | İstek gerçek backend'e gider, gerçek response döner |
| `Engelli` | İstek kesilir, seçili arıza döner (varsayılan 503) |
| *(listede yok)* | **Varsayılan politika** uygulanır (`Bloklansın` / `Geçsin`) |

Allow/block önceliği diye bir kavram yoktur: bir EP'nin tek bir durumu vardır.

## Kurulum (geliştirici modu)

```bash
npm install
npm run build
```

`chrome://extensions` → **Geliştirici modu** → **Paketlenmemiş öğe yükle** → `dist/` klasörünü seç.

## İki ayrı kapsam — en sık yapılan hata

DR-SIM'de **iki ayrı eksen** vardır; ikisi de doldurulmadan hiçbir şey çalışmaz:

| Kapsam | Ne yapar | Nereden |
|---|---|---|
| **Domain** | Hangi **isteklerin** yönetileceğini seçer (API host'u) | Panelde `Domain` alanı |
| **Sayfa** | Interceptor'ın hangi **sayfalara** enjekte edileceğini seçer (uygulama host'u) | Domain eklerken otomatik istenir |

Uygulama `panel.example.com`, API `api.example.com` ise ikisi de tanımlı olmalıdır: sayfaya enjekte edilmezse istekler hiç yakalanamaz. Domain eklerken aktif sayfanın origin'i **aynı izin dialoguna** eklendiği için bu normalde tek adımdır. Sonradan başka bir uygulama host'una geçersen panel kırmızı uyarı ve **Bu sayfada çalıştır** aksiyonu gösterir.

## İlk senaryo

1. Toolbar ikonuna tıkla — side panel açılır
2. **Domain** alanına API host'unu gir (`api.example.com`) ve izin ver
3. Hedef sayfayı aç; panelde uyarı çıkarsa **Bu sayfada çalıştır** → sayfayı yenile
4. **Simülasyon kapalıyken bile** envanter dolar (gözlem modu)
5. Sayfanın ayakta kalması için gereken EP'leri izin listesine al
6. **Simülasyonu aç**, sayfayı yenile — izin verilenler çalışır, gerisi 503 döner
7. **Son Fail'ler**'de beklenmedik bir kırılma görürsen satırdaki **`İzin ver`** ile tek tıkla listeye ekle
8. Envanterdeki toggle'larla ince ayar yap, sonucu **Rapor** olarak dışa aktar

Kısayol: `Alt+Shift+D` simülasyonu açar/kapatır.

## Test hedefi (fixture)

Gerçek bir uygulamaya bağlanmadan denemek için repoda bağımlılıksız bir hedef var:

```bash
npm run fixture   # uygulama :5174, API :5175
```

`http://localhost:5174` sayfasını aç, panelde **Domain** = `localhost:5175` ekle (izin dialogu her iki host'u da kapsar), sayfayı yenile. Sayfadaki butonlar `fetch`/`XHR` istekleri atar, SPA gezinmesi yapar, blok fırtınası tetikler; sonuçlar tabloda ve `window.__results` içinde görünür.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Watch modunda build (dist/ canlı güncellenir) |
| `npm run build` | Üç geçişli prod build → `dist/` |
| `npm run test` / `test:cov` | Vitest; `test:cov` `core/` için dosya bazında %100 eşiği uygular |
| `npm run lint` | ESLint + Stylelint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | lint → typecheck → test → build |
| `npm run preset` | Gömülü endpoint listesinden senaryo preset JSON'larını yeniden üretir |
| `npm run icons` | Toolbar ikonlarını yeniden üretir (bağımlılıksız PNG encoder) |
| `npm run pack` | `dist/` → sürüm etiketli zip |

## Mimari özeti

```
Side panel / options           (framework'süz TS, chrome.runtime portu)
            ▲ STATE_SNAPSHOT   │ COMMAND
Background service worker      (settings + tab session store, izin/scope, badge, auto-off)
            ▲ TELEMETRY        │ CONFIG
Content bridge (ISOLATED)      (token doğrulama, şema kontrolü, rate limit)
            ▲ postMessage      │ postMessage
Interceptor (MAIN, document_start)  (fetch + XHR patch, history patch, decide())
```

Karar mantığı `src/core/` içinde saf tutulur — hiçbir DOM/`chrome.*` bağımlılığı yoktur ve dosya bazında %100 test kapsamı hedeflenir.

## Gizlilik

DR-SIM **hiçbir veriyi cihaz dışına göndermez**. Analytics, crash reporting, uzak konfigürasyon yoktur. Tüm veriler `chrome.storage.local` (ayarlar/profiller) ve `chrome.storage.session` (envanter/loglar) içinde kalır. Header yakalama varsayılan olarak **kapalıdır**; açıldığında `authorization`, `cookie`, `token` gibi alanlar maskelenir. İstek gövdeleri hiçbir zaman kaydedilmez.

Statik host izni yoktur: eklenti yüklenirken Chrome hiçbir site izni istemez. İzin, domain eklendiğinde yalnızca o origin için istenir.

## Bilinen kapsam sınırı

MAIN world `fetch`/`XHR` patch'i şunları yakalayamaz: Service Worker içinden atılan istekler, `<img>/<script>/<link>` kaynak yüklemeleri, WebSocket, sync XHR, eklenti enjekte edilmeden önce atılmış istekler.

Bu bilinçli bir güvenlik payıdır: sayfanın kendi HTML/JS/CSS yüklemesi hiçbir zaman bloklanmaz, dolayısıyla uygulama her koşulda ayağa kalkar. Tam kapsam gerekirse `declarativeNetRequest` / `chrome.debugger` motorları backlog'dadır (T-801/T-802).

## Bilinçli ürün kararları

Bunlar eksik değil, tercih:

- **Arayüz yalnızca koyu temadır.** Açık tema paleti yoktur ve `prefers-color-scheme` dinlenmez. DR-SIM bir geliştirici aracı; panel gün boyu açık kalır ve koyu zemin log/EP listelerinde daha az yorar. Tasarım token'ları tek dosyada (`src/ui/styles/_variables.scss`) durduğu için ileride açık palet eklemek sınırlı bir iştir.
- **İstek gövdesi hiçbir zaman yakalanmaz.** DR senaryosu için gerekli değil ve en hassas veriyi diske yazma yüzeyini açardı.
- **Joker kural yoktur.** Bir EP'nin tek bir durumu vardır; öncelik/çakışma mantığı bilinçle dışarıda bırakılmıştır.

## Lisans

Bu proje **lisanssızdır**; `LICENSE` dosyasının olmaması bir eksiklik değil, bilinçli bir tercihtir.

Kaynak kod okunabilir olsun diye açıktadır. Lisans verilmediği için tüm hakları saklıdır: kod kopyalanamaz, dağıtılamaz, türev çalışma üretilemez ve kendi projende kullanılamaz. Kullanım izni gerekiyorsa <typeandgo07@gmail.com> adresinden yaz.

Eklentinin kendisi Chrome Web Store üzerinden serbestçe kurulabilir — bu kısıt yalnızca kaynak kodu kapsar.

---

# DR-SIM (English)

A Chrome extension (MV3) that **simulates which backend endpoints are down** in a web application. It needs no code change in the target app and covers all JS-originated traffic going through `fetch` and `XMLHttpRequest`.

Privacy policy: [`PRIVACY.md`](./PRIVACY.md)

## Rule model

There is a single rule list. Every endpoint has one of three states:

| State | Behaviour |
|---|---|
| `Allow` | The request reaches the real backend and the real response comes back |
| `Block` | The request is intercepted and the selected fault is returned (503 by default) |
| *(not listed)* | The **default policy** applies (`Block` / `Pass`) |

There is no allow/block precedence: an endpoint has exactly one state.

## Two separate scopes — the most common mistake

DR-SIM has **two independent axes**; nothing works until both are set:

| Scope | What it does | Where |
|---|---|---|
| **Domain** | Selects which **requests** are managed (the API host) | `Domain` field in the panel |
| **Page** | Selects which **pages** the interceptor is injected into (the app host) | Requested automatically when you add a domain |

If the app runs on `panel.example.com` and the API is `api.example.com`, both must be defined — without injection no request can be captured. Because the active page's origin is added to the **same permission dialog**, this is normally a single step.

## Install (developer mode)

```bash
npm install
npm run build
```

`chrome://extensions` → **Developer mode** → **Load unpacked** → pick the `dist/` folder.

## First run

1. Click the toolbar icon — the side panel opens
2. Type the API host into **Domain** (`api.example.com`) and grant permission
3. Open the target page; if the panel warns you, click **Run on this page** → reload
4. The inventory fills **even while the simulation is off** (observation mode)
5. Allow the endpoints the page needs to stay alive
6. **Turn the simulation on** and reload — allowed endpoints work, everything else returns 503
7. When something breaks unexpectedly, click **Allow** on that row in **Recent failures**
8. Fine-tune with the inventory toggles and export the result as a **Report**

Shortcut: `Alt+Shift+D` toggles the simulation.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Watch-mode build |
| `npm run build` | Three-pass production build → `dist/` |
| `npm run test` / `test:cov` | Vitest; `test:cov` enforces per-file 100% coverage for `core/` |
| `npm run lint` | ESLint + Stylelint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | lint → typecheck → test → build |
| `npm run fixture` | Dependency-free target app (app :5174, API :5175) |
| `npm run pack` | `dist/` → version-tagged zip |

## Privacy

DR-SIM **sends no data off the device**. No analytics, no crash reporting, no remote configuration. Header capture is off by default and masks sensitive fields when enabled; request bodies are never recorded. The extension ships with **no static host permissions** — access is requested at runtime, only for the domain you add.

## Known scope limit

The MAIN-world `fetch`/XHR patch cannot capture: requests made from a Service Worker, `<img>/<script>/<link>` resource loads, WebSockets, synchronous XHR, or requests fired before injection. This is a deliberate safety margin — the page's own HTML/JS/CSS is never blocked, so the app always boots.

## License

This project is **deliberately unlicensed** — the absence of a `LICENSE` file is a choice, not an oversight.

The source is public so that it can be read and audited. Because no license is granted, all rights are reserved: the code may not be copied, distributed, modified, or used in your own project. If you need permission, write to <typeandgo07@gmail.com>.

The extension itself installs freely from the Chrome Web Store — this restriction covers the source code only.
