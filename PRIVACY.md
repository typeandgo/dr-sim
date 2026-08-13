# DR-SIM — Privacy Policy

_Last updated: 13 August 2026_

**DR-SIM does not collect, transmit or sell any data.**

## What the extension stores

The extension stores your settings and your endpoint rule list in your browser's local storage (`chrome.storage.local`). While a simulation session is active it also keeps an inventory of the requests observed in the tab, in session storage.

All of this stays on your device and is removed when you uninstall the extension.

## What the extension does not do

- It does not send any data to any server.
- It contains no analytics, no telemetry and no third-party code.
- It downloads no code at runtime. The content security policy is fixed to `script-src 'self'`.

## Request headers

Recording of request headers is **disabled by default**. If you enable it in the settings, the data is written to local storage only, and sensitive fields — including authorization headers, cookies and token-like values — are masked before being written.

**Request bodies are never recorded.** The extension has no body-capture capability at all.

## Permissions

The extension ships with **no host permissions**. Access to a website is requested at runtime, in your own click context, and only for the domain you enter.

| Permission | Why it is needed |
| --- | --- |
| `storage` | Stores your rule list and settings locally on the device. |
| `scripting` | Registers the request interceptor on pages you have explicitly granted access to. |
| `tabs` | Reads the active tab's URL to show it in the panel and bind the request inventory to the correct tab. |
| `sidePanel` | The extension's entire user interface is a side panel. |
| `alarms` | Implements the optional auto-off timer. |
| Optional host permissions | Requested at runtime, only for the domain you add. |

## Contact

<typeandgo07@gmail.com>

---

# DR-SIM — Gizlilik Politikası

_Son güncelleme: 13 Ağustos 2026_

**DR-SIM hiçbir veriyi toplamaz, iletmez veya satmaz.**

## Eklentinin sakladıkları

Eklenti; ayarlarını ve endpoint kural listeni tarayıcının yerel deposunda (`chrome.storage.local`) saklar. Bir simülasyon oturumu açıkken sekmede gözlenen isteklerin envanterini de oturum deposunda tutar.

Bunların tamamı cihazında kalır ve eklentiyi kaldırdığında silinir.

## Eklentinin yapmadıkları

- Hiçbir veriyi hiçbir sunucuya göndermez.
- Analitik, telemetri veya üçüncü taraf kod içermez.
- Çalışma anında hiçbir kod indirmez. İçerik güvenlik politikası `script-src 'self'` olarak sabittir.

## İstek başlıkları

İstek başlığı kaydı **varsayılan olarak kapalıdır**. Ayarlardan açarsan veri yalnızca yerel depoya yazılır ve authorization başlığı, cookie ve token benzeri değerler dahil hassas alanlar yazılmadan önce maskelenir.

**İstek gövdeleri hiçbir zaman kaydedilmez.** Eklentide gövde yakalama yeteneği hiç yoktur.

## İzinler

Eklenti **hiçbir statik host izniyle** gelmez. Bir siteye erişim, çalışma anında, senin tıklama bağlamında ve yalnızca senin girdiğin domain için istenir.

| İzin | Neden gerekli |
| --- | --- |
| `storage` | Kural listeni ve ayarlarını cihazda saklar. |
| `scripting` | İnterceptor'ı yalnızca izin verdiğin sayfalara kaydeder. |
| `tabs` | Aktif sekmenin adresini panelde göstermek ve envanteri doğru sekmeye bağlamak için. |
| `sidePanel` | Eklentinin arayüzünün tamamı side panel'dir. |
| `alarms` | İsteğe bağlı auto-off zamanlayıcısı. |
| Opsiyonel host izinleri | Çalışma anında, yalnızca eklediğin domain için istenir. |

## İletişim

<typeandgo07@gmail.com>
