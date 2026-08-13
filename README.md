# DR-SIM

Web uygulamalarında **hangi backend endpoint'lerinin çalışmadığını simüle eden** Chrome eklentisi (MV3). Hedef uygulamada tek satır kod değişikliği gerektirmez; `fetch` ve `XMLHttpRequest` üzerinden giden tüm JS kaynaklı trafiği kapsar.

Tasarım ve görev planı: [`dr-sim-extension/`](./dr-sim-extension/README.md) · Yürütme durumu: [`08-execution-plan.md`](./dr-sim-extension/08-execution-plan.md)

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

> Ayrıntılı kurulum, fixture ile deneme akışı, hızlı QA listesi ve sorun giderme tablosu: **[09-kurulum-ve-test.md](./dr-sim-extension/09-kurulum-ve-test.md)**

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
| `npm run preset` | `§C.1` endpoint listesinden preset JSON'unu yeniden üretir |
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

DR-SIM **hiçbir veriyi cihaz dışına göndermez**. Analytics, crash reporting, uzak konfigürasyon yoktur. Tüm veriler `chrome.storage.local` (ayarlar/profiller) ve `chrome.storage.session` (envanter/loglar) içinde kalır. Header/body yakalama varsayılan olarak **kapalıdır**; açıldığında `authorization`, `cookie`, `token` gibi alanlar maskelenir.

Statik host izni yoktur: eklenti yüklenirken Chrome hiçbir site izni istemez. İzin, domain eklendiğinde yalnızca o origin için istenir.

## Bilinen kapsam sınırı

MAIN world `fetch`/`XHR` patch'i şunları yakalayamaz: Service Worker içinden atılan istekler, `<img>/<script>/<link>` kaynak yüklemeleri, WebSocket, sync XHR, eklenti enjekte edilmeden önce atılmış istekler.

Bu bilinçli bir güvenlik payıdır: sayfanın kendi HTML/JS/CSS yüklemesi hiçbir zaman bloklanmaz, dolayısıyla uygulama her koşulda ayağa kalkar. Tam kapsam gerekirse `declarativeNetRequest` / `chrome.debugger` motorları backlog'dadır (T-801/T-802).
