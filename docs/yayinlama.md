# Chrome Web Store'da Yayınlama

Bu doküman DR-SIM'i Chrome Web Store'a yüklerken izlenecek adımları, forma yapıştırılacak hazır metinleri (TR/EN) ve yayın öncesi kontrol listesini içerir.

---

## 1. Paketi hazırla

```bash
npm run verify   # lint + typecheck + test + build
npm run pack     # dr-sim-<sürüm>.zip üretir
```

`npm run pack`, `dist/` **içeriğini** zipler — yani `manifest.json` zip'in kökündedir. Mağazanın beklediği yapı budur.

**`dist.crx` ve `dist.pem` mağazaya yüklenmez.** Onlar kendi kendine dağıtım (self-hosted) içindir. Mağaza kendi imzasını atar ve eklenti kimliğini (ID) ilk yüklemede kendisi üretir; o ID sonraki tüm sürümlerde sabit kalır. `dist.pem` yine de saklanmalı ve paylaşılmamalıdır — `.gitignore`'dadır.

Sürüm numarası `package.json`'dan gelir; `scripts/build.mjs` her build'de `manifest.json`'a senkronlar. Her yeni yüklemede sürümü artırmak zorunludur (aynı sürüm ikinci kez kabul edilmez).

---

## 2. Geliştirici hesabı

[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → Google hesabı → **tek seferlik 5 USD** kayıt ücreti. Ödeme onaylanmadan yükleme yapılamaz.

---

## 3. Görünürlük kararı

| Seçenek | Ne demek | DR-SIM için |
| --- | --- | --- |
| **Public** | Mağaza aramasında ve kategoride çıkar | **Seçilen** |
| **Unlisted** | Yalnızca bağlantıyı bilen kurar | İlk yayın böyleydi |
| **Private** | Google Workspace domainiyle sınırlı | Şirket içi dağıtım için ideal |

DR-SIM ilk kez **unlisted** olarak yayınlandı ve onaylandı; sonrasında görünürlük **Public**'e çevrildi. Gerekçe: unlisted kurulum kolaylığını veriyordu ama keşfedilebilirlik vermiyordu — aracı arayarak bulabilecek geliştirici/QA kitlesine ulaşmanın tek yolu mağaza araması ve Developer Tools kategorisi.

### 3.1 Unlisted → Public geçişi

Developer Dashboard → öğe → **Distribution** sekmesi → **Visibility: Public** → sağ üstten **Submit for review**.

Bilinmesi gerekenler:

- Görünürlük değişikliği yeni bir gönderim sayılır; öğe tekrar "Pending review"a düşer. **Onaylanana kadar mevcut sürüm unlisted olarak yayında kalır** — kesinti olmaz.
- **Unlisted onayı public onayı anlamına gelmez.** Unlisted öğeler daha hafif incelemeden geçer; public'te tam inceleme uygulanır. DR-SIM ağ yanıtlarını değiştirdiği ve `*://*/*` opsiyonel host izni istediği için tam olarak ek sorgulama çeken profildir — gecikme ve red ihtimali unlisted'a göre yüksektir.
- Tam inceleme yalnızca değişikliğe değil, hâlihazırda yayında olan öğeye de bakar. Politika itirazı çıkarsa öğenin tamamen kaldırılması ihtimali düşük ama gerçektir.
- Geri dönüş mümkün: Public → Unlisted de aynı akışla yapılır, o da bir gönderimdir.

İncelemeden gelebilecek itirazlar ve hazır cevaplar §8'de.

---

## 4. Store listing metinleri

### 4.1 Kısa açıklama (132 karakter sınırı)

**EN**

```text
Test how your web app behaves when backend services fail — simulated safely in your own browser, without touching the server.
```

**TR**

```text
Backend servisleri çöktüğünde web uygulaman nasıl davranıyor? Sunucuya dokunmadan, yalnızca kendi tarayıcında simüle et.
```

### 4.2 Uzun açıklama

**EN**

```text
DR-SIM answers a question that is expensive to answer any other way: when one of the services behind your web application stops responding, does the rest of the app stay usable?

It interrupts the backend calls you choose — only in your own browser, only while you have it switched on. The server is never touched, no data is changed, and no other user is affected.

HOW IT WORKS

Add the domain your application pulls data from. Open the page and the panel fills with a live inventory of every endpoint the page calls. Switch the simulation on and requests start failing according to your rules.

The typical loop: set the default behaviour to "Block" so everything you have not allowed returns a fault, reload, see what breaks, then allow the endpoints the page genuinely needs — one click from the failure list. When the loop settles you know exactly what that page depends on.

WHAT YOU GET

• A live inventory of every endpoint each page calls, with call counts, status codes and timings
• Realistic failures: a 503 response with a body you control, a network error, or a request that never answers until it times out
• Per-endpoint rules with a single Allowed/Blocked switch
• Path normalization, so /orders/8842/detail and /orders/9110/detail count as one endpoint
• Shareable profiles: export your setup as a file, a teammate imports it and runs the same test
• Reports in Markdown (for a ticket) or JSON (for tooling)
• English and Turkish interface

PRIVACY

DR-SIM sends nothing anywhere. Everything stays in your browser's local storage. Request headers and bodies are not recorded at all by default; if you turn recording on, sensitive fields such as authorization headers, cookies and tokens are masked before they are written.

PERMISSIONS

The extension ships with no host permissions. Access to a site is requested at the moment you add its domain, in your own click context, and only for that domain.

Built as a developer and QA tool for disaster recovery drills and resilience testing.
```

**TR**

```text
DR-SIM, başka türlü öğrenmesi pahalı olan bir sorunun cevabını verir: web uygulamanın arkasındaki servislerden biri cevap vermemeye başladığında geri kalanı kullanılabilir kalıyor mu?

Seçtiğin backend çağrılarını keser — yalnızca senin tarayıcında ve yalnızca sen açıkken. Sunucuya dokunmaz, hiçbir veriyi değiştirmez, başka kullanıcılar etkilenmez.

NASIL ÇALIŞIR

Uygulamanın veri çektiği domaini ekle. Sayfayı aç; panel, sayfanın çağırdığı her endpoint'i canlı olarak listelemeye başlar. Simülasyonu aç, istekler kurallarına göre arıza dönmeye başlasın.

Tipik döngü: varsayılan davranışı "Bloklansın" yap, böylece izin vermediğin her şey arıza döner; sayfayı yenile, neyin bozulduğunu gör; sayfanın gerçekten ihtiyaç duyduğu endpoint'lere izin ver — hata listesinden tek tıkla. Döngü bittiğinde o sayfanın neye bağımlı olduğunu tam olarak bilirsin.

NELER VAR

• Her sayfanın çağırdığı endpoint'lerin canlı envanteri: çağrı sayısı, durum kodu, süre
• Gerçekçi arızalar: gövdesini senin belirlediğin 503 yanıtı, ağ hatası ya da hiç cevap vermeyip zaman aşımına düşen istek
• Endpoint başına tek anahtarla İzinli/Engelli kuralı
• Path normalizasyonu: /orders/8842/detail ile /orders/9110/detail tek endpoint sayılır
• Paylaşılabilir profiller: kurulumunu dosyaya aktar, ekip arkadaşın içe aktarıp aynı testi yapsın
• Markdown (ticket için) veya JSON (araçlar için) rapor
• Türkçe ve İngilizce arayüz

GİZLİLİK

DR-SIM hiçbir veriyi hiçbir yere göndermez. Her şey tarayıcının yerel deposunda kalır. İstek başlıkları ve gövdeleri varsayılan olarak hiç kaydedilmez; kaydı açarsan authorization, cookie, token gibi hassas alanlar yazılmadan önce maskelenir.

İZİNLER

Eklenti hiçbir statik host izniyle gelmez. Bir siteye erişim, tam da o sitenin domainini eklediğin anda, senin tıklama bağlamında ve yalnızca o domain için istenir.

Felaket senaryosu tatbikatları ve dayanıklılık testleri için bir geliştirici/QA aracı olarak yazıldı.
```

### 4.3 Kategori ve dil

- Kategori: **Developer Tools**
- Dil: English (varsayılan) + Turkish

### 4.4 Görseller

| Varlık | Boyut | Zorunlu |
| --- | --- | --- |
| Ekran görüntüsü | 1280×800 veya 640×400 PNG | **Evet**, en az 1 (en fazla 5) |
| Küçük tanıtım karesi | 440×280 | Hayır |
| Marquee | 1400×560 | Hayır |
| İkon | 128×128 | Manifest'ten otomatik gelir |

Hepsi depoda üretilir — elle hazırlanmaz:

```bash
npm run build
npm run store:assets   # → store-assets/ (5 ekran görüntüsü + 2 kapak)
```

Hangi dosyanın hangi alana gideceği ve tezgâhın nasıl çalıştığı [`store-assets/README.md`](../store-assets/README.md) içinde. Kısaca: panel ve ayarlar sayfası `dist/`'ten gelen **gerçek** arayüzdür, yanındaki demo uygulama **gerçek** interceptor'ı çalıştırır ve envanter/log/rapor ürünün kendi modüllerinden üretilir. Kareler 2× alınıp `sips` ile ölçeğe indirilir.

Anlatılan beş kare: (1) simülasyon açık — kırılan sayfa + EP envanteri, (2) gözlem modu — kurulum ve dolan envanter, (3) arıza tipi ve path normalizasyonu, (4) profil paylaşımı + rapor çıktısı, (5) gizlilik ve izinler.

Senaryoları değiştirmek gerekirse tek yer: `scripts/store-assets/scenes.mjs`.

---

## 5. Privacy sekmesi — hazır cevaplar

### 5.1 Single purpose

**EN**

```text
DR-SIM simulates backend endpoint failures in the user's own browser so that developers and QA engineers can test how a web application behaves during a partial outage.
```

**TR**

```text
DR-SIM, backend endpoint arızalarını kullanıcının kendi tarayıcısında simüle eder; böylece geliştiriciler ve test mühendisleri kısmi bir kesinti sırasında web uygulamasının nasıl davrandığını test edebilir.
```

### 5.2 İzin gerekçeleri

| İzin | Gerekçe (EN) |
| --- | --- |
| `storage` | Stores the user's rule list and settings locally on the device. Nothing is transmitted. |
| `scripting` | Registers the request interceptor on pages the user has explicitly granted access to. This is the core function of the extension. |
| `tabs` | Reads the active tab's URL to show it in the panel and to bind the captured request inventory to the correct tab. |
| `sidePanel` | The extension's entire user interface is a side panel. |
| `alarms` | Implements the optional auto-off timer that turns the simulation off after a user-defined duration. |
| `optional_host_permissions` (`*://*/*`) | Not requested at install time. Access is requested at runtime, in the user's own click context, only for the specific domain the user enters. Required because the extension cannot know in advance which application will be tested. |

### 5.3 Remote code

**No.** Eklenti sıfır çalışma zamanı bağımlılığıyla derlenir; tüm kod pakette bulunur, uzaktan kod indirilmez veya `eval` edilmez. CSP `script-src 'self'` olarak sabittir.

### 5.4 Veri kullanımı beyanı

Tüm kutular **işaretlenmez** — hiçbir veri toplanmıyor. Beyan edilecek:

- Kişisel bilgi: hayır
- Sağlık, finans, kimlik doğrulama bilgisi: hayır
- Kişisel iletişim, konum: hayır
- Web geçmişi: hayır
- Kullanıcı etkinliği: hayır
- Web sitesi içeriği: **hayır** — yakalanan istek verisi yalnızca cihazda tutulur, hiçbir yere iletilmez

Üç sertifikasyon kutusu işaretlenir: veriyi onaylanan amaç dışında kullanmama, üçüncü taraflara satmama, kredi değerlendirmesi/borç toplama için kullanmama.

### 5.5 Gizlilik politikası

URL gereklidir. Metin repoda **[`PRIVACY.md`](../PRIVACY.md)** olarak durur (iki dilde).

Repo public olduğu için doğrudan kullanılabilecek URL:

```text
https://github.com/typeandgo/dr-sim/blob/main/PRIVACY.md
```

Daha temiz bir adres istenirse GitHub Pages açılabilir (Settings → Pages → Source: `main` / root); o zaman adres `https://typeandgo.github.io/dr-sim/PRIVACY` olur. Mağaza ikisini de kabul eder.

Aşağıdaki metin `PRIVACY.md`'nin kısaltılmış hâlidir; ikisi değişirse **`PRIVACY.md` esas alınır**.

**EN**

```text
DR-SIM — Privacy Policy

DR-SIM does not collect, transmit or sell any data.

What the extension stores
The extension stores your settings and your endpoint rule list in your browser's local storage (chrome.storage.local). While a simulation session is active it also keeps an inventory of the requests observed in the tab, in session storage. All of this stays on your device and is removed when you uninstall the extension.

What the extension does not do
It does not send any data to any server. It contains no analytics, no telemetry and no third-party code. It downloads no code at runtime.

Request headers and bodies
Recording of request headers and bodies is disabled by default. If you enable it in the settings, the data is written to local storage only, and sensitive fields — including authorization headers, cookies and token-like values — are masked before being written.

Permissions
The extension ships with no host permissions. Access to a website is requested at runtime, in your own click context, and only for the domain you enter.

Contact: typeandgo07@gmail.com
```

**TR**

```text
DR-SIM — Gizlilik Politikası

DR-SIM hiçbir veriyi toplamaz, iletmez veya satmaz.

Eklentinin sakladıkları
Eklenti; ayarlarını ve endpoint kural listeni tarayıcının yerel deposunda (chrome.storage.local) saklar. Bir simülasyon oturumu açıkken sekmede gözlenen isteklerin envanterini de oturum deposunda tutar. Bunların tamamı cihazında kalır ve eklentiyi kaldırdığında silinir.

Eklentinin yapmadıkları
Hiçbir veriyi hiçbir sunucuya göndermez. Analitik, telemetri veya üçüncü taraf kod içermez. Çalışma anında hiçbir kod indirmez.

İstek başlıkları ve gövdeleri
İstek başlığı ve gövdesi kaydı varsayılan olarak kapalıdır. Ayarlardan açarsan veri yalnızca yerel depoya yazılır ve authorization başlığı, cookie ve token benzeri değerler dahil hassas alanlar yazılmadan önce maskelenir.

İzinler
Eklenti hiçbir statik host izniyle gelmez. Bir siteye erişim, çalışma anında, senin tıklama bağlamında ve yalnızca senin girdiğin domain için istenir.

İletişim: typeandgo07@gmail.com
```

---

## 6. Hazır senaryo dosyaları pakete girmez

`src/presets/` altındaki üç senaryo dosyası (`dr-odeme-ve-satin-alma`, `dr-fatura-sozlesme-raporlama`, `dr-hesap-mesaj-icerik`) eklenti paketine dahil edilmez — `pack.mjs` yalnızca `dist/` içeriğini zipler, preset'ler ise kaynak tarafında durur.

Kullanıcı bunları panelden `⤓ İçe` ile yükler. Jenerik bir başlangıç şablonu isteyen için kılavuzun yanındaki [`sample-profile.json`](./sample-profile.json) var.

**Not:** preset dosyaları artık depoda izleniyor ve repo public. Yani 142 endpoint path'i GitHub üzerinden okunabilir durumda. Bu bilinçli bir karardır; paketten uzak tutulmaları mağaza yüzeyini daraltır ama listeyi gizlemez.

---

## 7. Yayın öncesi kontrol listesi

- [ ] `npm run verify` yeşil
- [ ] `package.json` sürümü artırıldı (aynı sürüm ikinci kez kabul edilmez)
- [ ] `npm run pack` çalıştı, zip kökünde `manifest.json` var
- [ ] Zip içinde source map (`.map`) yok — `pack.mjs` bunu dışlar
- [ ] Zip içinde `src/presets/` yok
- [ ] `_locales/en` ve `_locales/tr` mesaj dosyaları eksiksiz (`extName`, `extDescription`, `commandToggle`)
- [ ] Manifest'te kullanıcıya görünen hiçbir metin sabit kodlanmamış (hepsi `__MSG_*__`)
- [ ] `npm run store:assets` çalıştı, `store-assets/` güncel (5 ekran görüntüsü + 2 kapak)
- [ ] Gizlilik politikası bir URL'de yayında (`PRIVACY.md`, repo public)
- [ ] Görünürlük **Public** (§3.1) — public listing için store listing eksiksiz olmalı: 132 karakterlik kısa açıklama, uzun açıklama, en az 1 ekran görüntüsü, kategori, dil
- [ ] `dist.pem` commit edilmemiş — `.gitignore`'da

---

## 8. İnceleme sonrası

İnceleme tipik olarak birkaç saat ile birkaç gün sürer; geniş host izni isteyen eklentilerde ve **public gönderimlerde** uzayabilir. Red gelirse gerekçe e-postayla bildirilir; en olası itiraz noktaları ve hazır cevapları:

| Olası itiraz | Cevap |
| --- | --- |
| "Neden `*://*/*` gerekiyor?" | §5.2'deki gerekçe: install anında istenmiyor, kullanıcı hareketiyle ve yalnızca girilen domain için isteniyor |
| "Ağ trafiğini değiştiriyor" | Amacın kendisi bu; yalnızca kullanıcının kendi tarayıcısında, kullanıcı açıkken ve kullanıcının yazdığı domainlerde. Sunucuya istek gitmiyor |
| "Uzak kod kullanıyor mu?" | Hayır; sıfır bağımlılık, CSP `script-src 'self'` |

Sürüm güncellemelerinde aynı zip akışı tekrarlanır; store listing metinleri korunur, yalnızca değişenler güncellenir.
