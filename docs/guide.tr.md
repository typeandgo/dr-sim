# DR-SIM — Kılavuz

[English](./guide.md) · **Türkçe**

DR-SIM nedir, nasıl kullanılır ve profil dosyasının anatomisi. İlk kez kullananlar için yazıldı; teknik bilgi gerektirmez.

## İçindekiler

- [DR-SIM nedir?](#dr-sim-nedir)
- [Neye yarar?](#neye-yarar)
- [Önce birkaç kelime](#önce-birkaç-kelime)
- [İlk kullanım: dört adım](#i̇lk-kullanım-dört-adım)
- [Günlük kullanım: dört adımlık döngü](#günlük-kullanım-dört-adımlık-döngü)
- [Envanteri okumak](#envanteri-okumak)
- [En sık yapılan hata: iki farklı adres](#en-sık-yapılan-hata-iki-farklı-adres)
- [Profiller: kurulumunu paylaş](#profiller-kurulumunu-paylaş)
- [Raporlar](#raporlar)
- [Bir şeyler çalışmıyorsa](#bir-şeyler-çalışmıyorsa)
- [Verilerin nereye gidiyor?](#verilerin-nereye-gidiyor)
- [Örnek profil](#örnek-profil)
- [Profil alanları](#profil-alanları)

## DR-SIM nedir?

Bir web uygulaması, sen farkında olmadan arka plandaki servislere sürekli soru sorar: bu kullanıcı kim, sepette ne var, şu kaydın detayları neler. Peki bu servislerden biri çalışmazsa ne olur? Ekran boş mu kalır, anlamlı bir uyarı mı çıkar, yoksa sayfa tamamen kilitlenir mi?

DR-SIM bu soruyu, gerçekten hiçbir şeyi bozmadan yanıtlamanı sağlar. Seçtiğin servis çağrılarını yalnızca senin tarayıcında ve yalnızca sen açıkken kesintiye uğratır. Sunucuya dokunmaz, veritabanını değiştirmez, başka kullanıcılar hiçbir şey hissetmez.

> Kısacası: “şu servis çökseydi ne olurdu?” sorusunun provasını, kimseyi etkilemeden yapmanı sağlar.

## Neye yarar?

Felaket senaryosu tatbikatlarında (DR testi) asıl merak edilen şudur: sistemin bir parçası düştüğünde geri kalanı ayakta kalabiliyor mu? Bunu gerçek bir kesintiyi bekleyerek öğrenmek pahalıdır.

- Gerçek bir kesinti yaşanmadan önce hazırlanırsın.
- Hangi ekranın hangi servise bağımlı olduğunu siyah beyaz görürsün.
- Kullanıcıya gösterilen hata mesajlarının gerçekten anlaşılır olup olmadığını denersin.
- Bulduklarını rapor olarak indirip ekiple paylaşırsın.

## Önce birkaç kelime

Panelde geçen birkaç terim var. Hepsi göründüğünden basit:

- **Endpoint (kısaca EP)** — Uygulamanın arka plandan bir şey istediği tek bir adres. Panelde “GET /kullanicilar/mevcut” gibi görünür. Sayfanın attığı her ayrı soru bir EP’dir.
- **Domain** — Bu soruların gittiği sunucu, örneğin api.sirket.com. DR-SIM yalnızca senin yazdığın domainlere giden istekleri yönetir; geri kalan her şeye dokunmaz.
- **Kural** — Bir EP için verdiğin karar: İzinli (normal çalışsın) ya da Engelli (arıza dönsün).
- **Varsayılan davranış** — Hakkında kural yazmadığın EP’lere ne olacağı. “Bloklansın” dersen listende olmayan her şey arıza döner; “Geçsin” dersen yalnızca tek tek engellediklerin arıza döner.
- **Arıza** — Engellenen bir isteğin nasıl başarısız olacağı: sunucu hatası (503), ağ hatası ya da hiç cevap vermeyip zaman aşımına düşmesi.

## İlk kullanım: dört adım

1. Test edeceğin uygulamayı bir sekmede aç, sonra eklenti ikonuna tıkla. Panel yandan açılır.
2. Panelin en üstündeki Domain kutusuna uygulamanın veri çektiği adresi yaz (örneğin api.sirket.com) ve Ekle’ye bas. Chrome izin isteyecek; İzin ver de.
3. Sayfayı yenile. “Sayfa EP Envanteri” dolmaya başlar — uygulamanın hangi servisleri çağırdığını canlı görürsün.
4. Hazır olduğunda sağ üstteki anahtarı ON yap. Artık istekler kurallarına göre engellenmeye başlar.

> Anahtar OFF iken de envanter dolar. Yani önce sadece izleyip uygulamayı tanıyabilir, kararlarını sonra verebilirsin.

## Günlük kullanım: dört adımlık döngü

DR-SIM’in asıl kullanımı şu döngüdür. Her sayfa için tekrarlarsın:

1. Varsayılan davranışı “Bloklansın” yap. Böylece izin vermediğin her şey arıza döner — yani en sert senaryoyu test edersin.
2. Sayfayı yenile ve neyin çalışmadığına bak. Muhtemelen sayfa hiç açılmayacak; bu normaldir.
3. Sayfanın ayağa kalkması için gerçekten gereken EP’lere izin ver. En pratik yolu, “Son Fail’ler” listesindeki İzin ver düğmesidir.
4. Tekrar yenile. Bu döngü bittiğinde elinde “bu sayfa en az şunlarla ayakta kalıyor” listesi olur.

Bir sonraki sayfaya geçmeden önce Sıfırla’ya basarsın; kural listesi temizlenir ve yeni sayfaya sıfırdan başlarsın.

## Envanteri okumak

Envanterdeki her satır bir EP’dir. Satırın solundaki renkli çubuk iki ayrı şey söyler: rengi o EP’nin şu anki durumunu, biçimi ise bu durumun nereden geldiğini.

- **Kırmızı ya da yeşil** — Kırmızı: bu EP şu anda engelli, çağrıldığında arıza döner. Yeşil: izinli, normal çalışır. Satırın sağındaki düğme de aynı şeyi yazar; tıklayınca durumu çevirirsin.
- **Düz çizgi** — Bu EP için kararı sen vermişsin, yani yazılı bir kuralı var. Varsayılan davranışı değiştirsen bile bu satır olduğu gibi kalır.
- **Kesik çizgi** — Bu EP için kural yok; satır varsayılan davranışı izliyor. Varsayılanı “Bloklansın”dan “Geçsin”e çevirdiğinde bu satırların rengi de birlikte döner.
- **✕ düğmesi** — Yazdığın kuralı siler ve satırı varsayılana iade eder — yani düz çizgiyi kesik çizgiye çevirir. Kuralı olmayan bir satırda basmak zararsızdır, hiçbir şey değişmez.

Satırdaki küçük etiketler ise EP’nin nereden bilindiğini söyler:

- **profil** — Bu EP yüklediğin profilde tanımlı — yani ekipçe üzerinde anlaştığınız senaryonun bir parçası.
- **sayfa** — Bu EP sayfayı gezerken bulundu ama profilde yok. Profili tamamlamak, bu etiketleri teker teker azaltmak demektir.
- **sync XHR** — İstek beklenemeyen eski bir yöntemle yapılmış; DR-SIM onu engelleyemez, olduğu gibi geçirir. Bir EP bir türlü bloklanmıyorsa önce bu etikete bak.

> Çubuk ile etiket ayrı sorulara cevap verir: çubuk “bu EP için kural yazdım mı”, etiket “bu EP profilimde tanımlı mı”. Bir EP’ye elle izin verip profiline hiç yazmamış olabilirsin.

## En sık yapılan hata: iki farklı adres

Uygulamanın açıldığı adres ile veri çektiği adres çoğu zaman farklıdır. Sen panel.sirket.com’da gezinirsin ama veriler api.sirket.com’dan gelir.

DR-SIM’in çalışabilmesi için ikisini de bilmesi gerekir: Domain hangi isteklerin yönetileceğini, Aktif sayfa ise eklentinin hangi sayfanın içinde çalışacağını söyler. Panelde “Bu sayfaya enjekte edilmiyor” uyarısını görürsen, Bu sayfada çalıştır düğmesine basıp sayfayı yenilemen yeterli.

> Bir şey yakalanmıyorsa ilk bakılacak yer burasıdır.

## Profiller: kurulumunu paylaş

Kurduğun senaryoyu — hangi EP’ler engelli, hangi domainler kapsamda, arıza tipi ne — tek bir dosyaya aktarabilirsin.

Panelin Profil bölümünde “⤒ Dışa” ile indirirsin, ekip arkadaşına gönderirsin, o da “⤓ İçe” ile alır. Aynı testi aynı kurulumla tekrarlamış olursunuz. İstemediğin bir profili Kaldır ile listeden çıkarabilirsin.

## Raporlar

Panelin en altında iki indirme düğmesi var:

- **⤓ Rapor MD** — O sayfada neyin bloklandığını, neyin geçtiğini ve tur özetini okunabilir bir metin olarak indirir. Bir kayda ya da göreve yapıştırmak için idealdir; gözlemini yazacağın boş bir alan bırakır.
- **⤓ Rapor JSON** — Ham veriyi verir: her isteğin süresi, durum kodu, tüm başarı ve hata kayıtları. Başka bir araca aktarmak ya da iki turu karşılaştırmak için.

## Bir şeyler çalışmıyorsa

- Panelde hiç istek görünmüyor: domaini eklediğinden ve sayfayı yenilediğinden emin ol. Eklenti sayfaya yüklenme anında girer, o yüzden yenilemek şart.
- Chrome izin penceresi açılmadı: domain eklenmemiştir, tekrar Ekle’ye bas. Daha önce izin verip sonra geri aldıysan domain sarı görünür ve yanındaki “İzin ver” ile geri kazandırabilirsin.
- Her şey bloklanıyor, sayfa hiç açılmıyor: bu beklenen davranıştır, testin kendisidir. Gereken EP’lere izin vererek ilerle; hızlıca çıkmak istersen anahtarı OFF yap.
- “Bu sayfa türünde eklenti çalışamaz” yazıyor: tarayıcının kendi sayfalarında (chrome:// ile başlayanlar, eklenti mağazası) hiçbir eklenti çalışamaz. Normal bir web sayfasına geç.
- Sayfa açılıyor ama hiçbir şey engellenmiyor: anahtar ON mu, domain doğru mu ve varsayılan davranış beklediğin gibi mi, sırayla kontrol et.

## Verilerin nereye gidiyor?

Hiçbir yere. Her şey yalnızca kendi bilgisayarında, tarayıcının kendi deposunda kalır; DR-SIM hiçbir veriyi hiçbir sunucuya göndermez.

İstek başlıkları varsayılan olarak hiç kaydedilmez. Ayarlardan açarsan da parola, oturum anahtarı gibi hassas alanlar kayda geçerken maskelenir. İstek gövdeleri hiçbir koşulda kaydedilmez.

## Örnek profil

Hazır bir profil dosyası. İndir, domain ve kuralları kendi uygulamana göre değiştir, sonra panelden “⤓ İçe” ile yükle.

```json
{
  "id": "ornek-profil",
  "name": "Örnek — ödeme kapalı",
  "defaultPolicy": "block",
  "domains": [
    {
      "id": "d1",
      "pattern": "api.example.com"
    }
  ],
  "rules": [
    {
      "key": "GET /users/current",
      "method": "GET",
      "path": "/users/current",
      "state": "allow",
      "source": "preset",
      "note": "giriş için gerekli, açık kalmalı",
      "createdAt": 0
    },
    {
      "key": "GET /orders/:id/detail",
      "method": "GET",
      "path": "/orders/:id/detail",
      "state": "allow",
      "source": "preset",
      "note": "kayıt id’si :id ile normalize edildi",
      "createdAt": 0
    },
    {
      "key": "POST /payments/checkout",
      "method": "POST",
      "path": "/payments/checkout",
      "state": "block",
      "source": "preset",
      "note": "DR senaryosunda test edilen uç",
      "createdAt": 0
    }
  ],
  "fault": {
    "kind": "http",
    "status": 503,
    "statusText": "Service Unavailable",
    "body": "{\"message\":\"DR simulated unavailable\"}",
    "headers": {},
    "delayMs": 0,
    "timeoutMs": 30000
  },
  "updatedAt": 0
}
```

Aynı dosya depoda: [`sample-profile.json`](./sample-profile.json)

> Hazır senaryo dosyaları eklenti paketine dahil değildir. Ekibinden aldığın bir profil dosyasını panelden “⤓ İçe” ile yüklersin.

## Profil alanları

Yukarıdaki dosyanın sözlüğü: hangi anahtar ne demek. Zorunlu olan tek alan “rules” listesidir; kalanı verilmezse mevcut ayarların geçerli kalır.

### `{ … }` — Kök alanlar

Dosyanın en dış katmanı. İçe aktarmanın zorunlu tuttuğu tek alan “rules” listesidir; kalanı eksikse mevcut ayarların ya da varsayılanların yerini korur.

| Alan | Tip | Zorunlu | Anlamı |
| --- | --- | --- | --- |
| `rules` | dizi | evet | Kural kayıtları. Profilin asıl içeriği budur; boş dizi de geçerlidir ama o zaman profil hiçbir şey değiştirmez. |
| `name` | metin | hayır | Panelin profil listesinde görünen ad. Boş bırakılırsa arayüz dilinde bir yedek ad atanır. Dışa aktarılan dosyanın adı da bundan türer. |
| `defaultPolicy` | "block" \| "pass" | hayır | Hakkında kural yazılmamış EP’lere ne olacağı. "block" → listede olmayan her şey arıza döner. "pass" → yalnızca tek tek engellediklerin arıza döner. Tanınmayan değer "block" sayılır. |
| `domains` | dizi | hayır | Profille birlikte gelen domain kapsamı. Boş dizi verirsen profil uygulanırken mevcut domainlerin korunur — paylaşılan bir profilin senin kapsamını silmemesi için. |
| `fault` | nesne | hayır | Engellenen isteklerin nasıl başarısız olacağı. Verilmezse mevcut arıza ayarın korunur. |
| `id` | metin | hayır | Profilin kimliği. Aynı id ile ikinci kez içe aktarırsan eskisinin üzerine yazılır. Boş bırakırsan yeni bir kimlik üretilir — elle yazmana genelde gerek yoktur. |
| `updatedAt` | sayı | hayır | Son değişiklik zamanı (Unix ms). İçe aktarırken yok sayılır ve o anki zamanla değiştirilir; elle 0 bırakabilirsin. |

### `rules[]` — Kural kaydı

Her kayıt tek bir EP’nin durumunu belirtir. Joker desteklenmez: bir EP’nin tek bir durumu vardır, öncelik ya da çakışma mantığı yoktur.

| Alan | Tip | Zorunlu | Anlamı |
| --- | --- | --- | --- |
| `key` | metin | evet | Birincil anahtar; “METHOD /path” biçiminde ve tam olarak `method` + boşluk + `path` olmalıdır. Eşleşme bunun üzerinden yapılır, iki alanla tutarsız bir key kuralı ulaşılmaz kılar. |
| `method` | metin | evet | HTTP metodu, büyük harf: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. |
| `path` | metin | evet | Normalize edilmiş yol. Değişken segmentler :id ile yazılır — /orders/8842/detail değil, /orders/:id/detail. Ham id bırakırsan kural yalnızca o tek kayda uyar ve pratikte hiç eşleşmez. |
| `state` | "allow" \| "block" | evet | "allow" → istek gerçek backend’e gider. "block" → istek kesilir ve seçili arıza döner. |
| `source` | "inventory" \| "manual" \| "preset" \| "quick-allow" | hayır | Kaydın nereden geldiği; yalnızca bilgi amaçlıdır, karara etkisi yoktur. Elle yazılan profillerde "preset" uygun bir seçimdir. |
| `note` | metin | hayır | Serbest açıklama — “giriş için gerekli, açık kalmalı” gibi. Profili paylaşırken kararın gerekçesini taşımanın en kolay yolu. |
| `createdAt` | sayı | hayır | Kaydın oluşturulma zamanı (Unix ms). Elle yazarken 0 bırakabilirsin. |

### `domains[]` — Domain kapsamı

Hangi isteklerin yönetileceğini seçer; yani API host’unu. Bu listede olmayan hiçbir isteğe dokunulmaz.

| Alan | Tip | Zorunlu | Anlamı |
| --- | --- | --- | --- |
| `pattern` | metin | evet | Host, isteğe bağlı bir alt yol ile: api.example.com, *.example.com, api.example.com/gw. Protokol yazma. Port yazabilirsin (localhost:5175) — istek eşleşmesinde korunur. |
| `id` | metin | hayır | Kayıt kimliği. Elle yazarken kısa bir değer yeterlidir; benzersiz olması dışında bir anlamı yoktur. |
| `granted` | true \| false | hayır | Host izninin verilip verilmediği. Bu alan dosyadan okunmaz, uygulanırken tarayıcının gerçek izin durumuna göre yeniden hesaplanır — profil paylaşarak izin taşınamaz. |

### `fault` — Arıza ayarı

Engellenen her istek bu şekilde başarısız olur. Ayar globaldir: kural bazlı ayrı arıza yoktur.

| Alan | Tip | Zorunlu | Anlamı |
| --- | --- | --- | --- |
| `kind` | "http" \| "network" \| "timeout" | evet | "http" → seçtiğin durum koduyla yanıt döner. "network" → istek ağ hatasıyla düşer (sunucuya hiç ulaşılamamış gibi). "timeout" → yanıt hiç gelmez, süre dolunca zaman aşımına düşer. |
| `status` | sayı | evet | HTTP durum kodu — 503, 500, 429 gibi. Yalnızca kind "http" iken kullanılır. |
| `statusText` | metin | evet | Durum metni, örneğin "Service Unavailable". Yalnızca kind "http" iken kullanılır. |
| `body` | metin | evet | Yanıt gövdesi; JSON göndermek istiyorsan JSON’un kendisini METİN olarak yaz. Geçerli JSON ise content-type application/json, değilse düz metin olarak döner. |
| `headers` | nesne | evet | Yanıta eklenecek ek başlıklar. Boş nesne ({}) olağan durumdur. Simüle yanıtlara her hâlükârda bir x-drsim-simulated başlığı eklenir. |
| `delayMs` | sayı | evet | Arıza dönmeden önce beklenecek süre (ms). Yavaş servis taklidi için kullanılır; 0 anında yanıt demektir. |
| `timeoutMs` | sayı | evet | Zaman aşımına düşmeden önce beklenecek süre (ms). Yalnızca kind "timeout" iken kullanılır. |

---

[← README'ye dön](../README.md)
