import type { Locale } from '@/core/i18n';

// Kullanıcı kılavuzu — 02-ui-spec.md §4.1 (Revizyon 47).
//
// Metin bilerek `core/i18n.ts` sözlüğüne KONMADI: orası service worker'a da
// bundle ediliyor (rapor, badge, banner metinleri için) ve kılavuz uzun. Burada
// durunca yalnızca options sayfasının paketine giriyor.
//
// Blok yapısı, `innerHTML` kullanmadan (kural: yalnızca textContent) zengin
// içerik üretmek içindir; vurgu için satır içi işaretleme yerine ayrı düğümler
// kullanılır (`terms` bloğu).

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'terms'; items: Array<{ term: string; desc: string }> };

export interface GuideChapter {
  title: string;
  blocks: GuideBlock[];
}

const TR: GuideChapter[] = [
  {
    title: 'DR-SIM nedir?',
    blocks: [
      {
        kind: 'p',
        text: 'Bir web uygulaması, sen farkında olmadan arka plandaki servislere sürekli soru sorar: bu kullanıcı kim, sepette ne var, şu kaydın detayları neler. Peki bu servislerden biri çalışmazsa ne olur? Ekran boş mu kalır, anlamlı bir uyarı mı çıkar, yoksa sayfa tamamen kilitlenir mi?',
      },
      {
        kind: 'p',
        text: 'DR-SIM bu soruyu, gerçekten hiçbir şeyi bozmadan yanıtlamanı sağlar. Seçtiğin servis çağrılarını yalnızca senin tarayıcında ve yalnızca sen açıkken kesintiye uğratır. Sunucuya dokunmaz, veritabanını değiştirmez, başka kullanıcılar hiçbir şey hissetmez.',
      },
      {
        kind: 'note',
        text: 'Kısacası: “şu servis çökseydi ne olurdu?” sorusunun provasını, kimseyi etkilemeden yapmanı sağlar.',
      },
    ],
  },
  {
    title: 'Neye yarar?',
    blocks: [
      {
        kind: 'p',
        text: 'Felaket senaryosu tatbikatlarında (DR testi) asıl merak edilen şudur: sistemin bir parçası düştüğünde geri kalanı ayakta kalabiliyor mu? Bunu gerçek bir kesintiyi bekleyerek öğrenmek pahalıdır.',
      },
      {
        kind: 'list',
        items: [
          'Gerçek bir kesinti yaşanmadan önce hazırlanırsın.',
          'Hangi ekranın hangi servise bağımlı olduğunu siyah beyaz görürsün.',
          'Kullanıcıya gösterilen hata mesajlarının gerçekten anlaşılır olup olmadığını denersin.',
          'Bulduklarını rapor olarak indirip ekiple paylaşırsın.',
        ],
      },
    ],
  },
  {
    title: 'Önce birkaç kelime',
    blocks: [
      {
        kind: 'p',
        text: 'Panelde geçen birkaç terim var. Hepsi göründüğünden basit:',
      },
      {
        kind: 'terms',
        items: [
          {
            term: 'Endpoint (kısaca EP)',
            desc: 'Uygulamanın arka plandan bir şey istediği tek bir adres. Panelde “GET /kullanicilar/mevcut” gibi görünür. Sayfanın attığı her ayrı soru bir EP’dir.',
          },
          {
            term: 'Domain',
            desc: 'Bu soruların gittiği sunucu, örneğin api.sirket.com. DR-SIM yalnızca senin yazdığın domainlere giden istekleri yönetir; geri kalan her şeye dokunmaz.',
          },
          {
            term: 'Kural',
            desc: 'Bir EP için verdiğin karar: İzinli (normal çalışsın) ya da Engelli (arıza dönsün).',
          },
          {
            term: 'Varsayılan davranış',
            desc: 'Hakkında kural yazmadığın EP’lere ne olacağı. “Bloklansın” dersen listende olmayan her şey arıza döner; “Geçsin” dersen yalnızca tek tek engellediklerin arıza döner.',
          },
          {
            term: 'Arıza',
            desc: 'Engellenen bir isteğin nasıl başarısız olacağı: sunucu hatası (503), ağ hatası ya da hiç cevap vermeyip zaman aşımına düşmesi.',
          },
        ],
      },
    ],
  },
  {
    title: 'İlk kullanım: dört adım',
    blocks: [
      {
        kind: 'steps',
        items: [
          'Test edeceğin uygulamayı bir sekmede aç, sonra eklenti ikonuna tıkla. Panel yandan açılır.',
          'Panelin en üstündeki Domain kutusuna uygulamanın veri çektiği adresi yaz (örneğin api.sirket.com) ve Ekle’ye bas. Chrome izin isteyecek; İzin ver de.',
          'Sayfayı yenile. “Sayfa EP Envanteri” dolmaya başlar — uygulamanın hangi servisleri çağırdığını canlı görürsün.',
          'Hazır olduğunda sağ üstteki anahtarı ON yap. Artık istekler kurallarına göre engellenmeye başlar.',
        ],
      },
      {
        kind: 'note',
        text: 'Anahtar OFF iken de envanter dolar. Yani önce sadece izleyip uygulamayı tanıyabilir, kararlarını sonra verebilirsin.',
      },
    ],
  },
  {
    title: 'Günlük kullanım: dört adımlık döngü',
    blocks: [
      {
        kind: 'p',
        text: 'DR-SIM’in asıl kullanımı şu döngüdür. Her sayfa için tekrarlarsın:',
      },
      {
        kind: 'steps',
        items: [
          'Varsayılan davranışı “Bloklansın” yap. Böylece izin vermediğin her şey arıza döner — yani en sert senaryoyu test edersin.',
          'Sayfayı yenile ve neyin çalışmadığına bak. Muhtemelen sayfa hiç açılmayacak; bu normaldir.',
          'Sayfanın ayağa kalkması için gerçekten gereken EP’lere izin ver. En pratik yolu, “Son Fail’ler” listesindeki İzin ver düğmesidir.',
          'Tekrar yenile. Bu döngü bittiğinde elinde “bu sayfa en az şunlarla ayakta kalıyor” listesi olur.',
        ],
      },
      {
        kind: 'p',
        text: 'Bir sonraki sayfaya geçmeden önce Sıfırla’ya basarsın; kural listesi temizlenir ve yeni sayfaya sıfırdan başlarsın.',
      },
    ],
  },
  {
    title: 'En sık yapılan hata: iki farklı adres',
    blocks: [
      {
        kind: 'p',
        text: 'Uygulamanın açıldığı adres ile veri çektiği adres çoğu zaman farklıdır. Sen panel.sirket.com’da gezinirsin ama veriler api.sirket.com’dan gelir.',
      },
      {
        kind: 'p',
        text: 'DR-SIM’in çalışabilmesi için ikisini de bilmesi gerekir: Domain hangi isteklerin yönetileceğini, Aktif sayfa ise eklentinin hangi sayfanın içinde çalışacağını söyler. Panelde “Bu sayfaya enjekte edilmiyor” uyarısını görürsen, Bu sayfada çalıştır düğmesine basıp sayfayı yenilemen yeterli.',
      },
      {
        kind: 'note',
        text: 'Bir şey yakalanmıyorsa ilk bakılacak yer burasıdır.',
      },
    ],
  },
  {
    title: 'Profiller: kurulumunu paylaş',
    blocks: [
      {
        kind: 'p',
        text: 'Kurduğun senaryoyu — hangi EP’ler engelli, hangi domainler kapsamda, arıza tipi ne — tek bir dosyaya aktarabilirsin.',
      },
      {
        kind: 'p',
        text: 'Panelin Profil bölümünde “⤒ Dışa” ile indirirsin, ekip arkadaşına gönderirsin, o da “⤓ İçe” ile alır. Aynı testi aynı kurulumla tekrarlamış olursunuz. İstemediğin bir profili Kaldır ile listeden çıkarabilirsin.',
      },
    ],
  },
  {
    title: 'Raporlar',
    blocks: [
      {
        kind: 'p',
        text: 'Panelin en altında iki indirme düğmesi var:',
      },
      {
        kind: 'terms',
        items: [
          {
            term: '⤓ Rapor MD',
            desc: 'O sayfada neyin bloklandığını, neyin geçtiğini ve tur özetini okunabilir bir metin olarak indirir. Bir kayda ya da göreve yapıştırmak için idealdir; gözlemini yazacağın boş bir alan bırakır.',
          },
          {
            term: '⤓ Rapor JSON',
            desc: 'Ham veriyi verir: her isteğin süresi, durum kodu, tüm başarı ve hata kayıtları. Başka bir araca aktarmak ya da iki turu karşılaştırmak için.',
          },
        ],
      },
    ],
  },
  {
    title: 'Bir şeyler çalışmıyorsa',
    blocks: [
      {
        kind: 'list',
        items: [
          'Panelde hiç istek görünmüyor: domaini eklediğinden ve sayfayı yenilediğinden emin ol. Eklenti sayfaya yüklenme anında girer, o yüzden yenilemek şart.',
          'Chrome izin penceresi açılmadı: Ayarlar sayfasındaki Site izinleri bölümünden elle verebilirsin.',
          'Her şey bloklanıyor, sayfa hiç açılmıyor: bu beklenen davranıştır, testin kendisidir. Gereken EP’lere izin vererek ilerle; hızlıca çıkmak istersen anahtarı OFF yap.',
          '“Bu sayfa türünde eklenti çalışamaz” yazıyor: tarayıcının kendi sayfalarında (chrome:// ile başlayanlar, eklenti mağazası) hiçbir eklenti çalışamaz. Normal bir web sayfasına geç.',
          'Sayfa açılıyor ama hiçbir şey engellenmiyor: anahtar ON mu, domain doğru mu ve varsayılan davranış beklediğin gibi mi, sırayla kontrol et.',
        ],
      },
    ],
  },
  {
    title: 'Verilerin nereye gidiyor?',
    blocks: [
      {
        kind: 'p',
        text: 'Hiçbir yere. Her şey yalnızca kendi bilgisayarında, tarayıcının kendi deposunda kalır; DR-SIM hiçbir veriyi hiçbir sunucuya göndermez.',
      },
      {
        kind: 'p',
        text: 'İstek başlıkları ve gövdeleri varsayılan olarak hiç kaydedilmez. Ayarlardan açarsan da parola, oturum anahtarı gibi hassas alanlar kayda geçerken maskelenir.',
      },
    ],
  },
];

const EN: GuideChapter[] = [
  {
    title: 'What is DR-SIM?',
    blocks: [
      {
        kind: 'p',
        text: 'Without you noticing, a web application constantly asks questions to services running behind it: who is this user, what is in the cart, what are the details of this record. So what happens when one of those services stops working? Does the screen go blank, does a helpful warning appear, or does the page lock up completely?',
      },
      {
        kind: 'p',
        text: 'DR-SIM lets you answer that question without breaking anything for real. It interrupts the service calls you choose, only in your own browser and only while you have it switched on. It never touches the server, never changes the database, and no other user feels a thing.',
      },
      {
        kind: 'note',
        text: 'In short: it lets you rehearse “what if that service went down?” without affecting anyone.',
      },
    ],
  },
  {
    title: 'What is it good for?',
    blocks: [
      {
        kind: 'p',
        text: 'In disaster recovery drills the real question is this: when one part of the system falls over, can the rest stay on its feet? Waiting for a genuine outage to find out is an expensive way to learn.',
      },
      {
        kind: 'list',
        items: [
          'You prepare before a real outage happens.',
          'You see in black and white which screen depends on which service.',
          'You test whether the error messages shown to users are actually understandable.',
          'You download what you found as a report and share it with the team.',
        ],
      },
    ],
  },
  {
    title: 'A few words first',
    blocks: [
      {
        kind: 'p',
        text: 'A handful of terms come up in the panel. All of them are simpler than they look:',
      },
      {
        kind: 'terms',
        items: [
          {
            term: 'Endpoint (EP for short)',
            desc: 'A single address the application asks for something from. It appears in the panel as something like “GET /users/current”. Every separate question the page asks is one EP.',
          },
          {
            term: 'Domain',
            desc: 'The server those questions go to, for example api.company.com. DR-SIM only manages requests going to the domains you enter; it leaves everything else alone.',
          },
          {
            term: 'Rule',
            desc: 'The decision you make for an EP: Allowed (let it work normally) or Blocked (return a fault).',
          },
          {
            term: 'Default behaviour',
            desc: 'What happens to EPs you have written no rule for. Choose “Block” and everything outside your list returns a fault; choose “Pass” and only the ones you blocked individually return a fault.',
          },
          {
            term: 'Fault',
            desc: 'How a blocked request fails: a server error (503), a network error, or no answer at all until it times out.',
          },
        ],
      },
    ],
  },
  {
    title: 'First run: four steps',
    blocks: [
      {
        kind: 'steps',
        items: [
          'Open the application you want to test in a tab, then click the extension icon. The panel opens at the side.',
          'In the Domain box at the top of the panel, type the address the application pulls data from (for example api.company.com) and press Add. Chrome will ask for permission; grant it.',
          'Reload the page. The “Page EP inventory” starts filling up — you see live which services the application calls.',
          'When you are ready, flip the switch at the top right to ON. Requests now start being blocked according to your rules.',
        ],
      },
      {
        kind: 'note',
        text: 'The inventory fills up even while the switch is OFF. So you can just watch first, get to know the application, and decide later.',
      },
    ],
  },
  {
    title: 'Everyday use: a four-step loop',
    blocks: [
      {
        kind: 'p',
        text: 'This loop is what DR-SIM is really for. You repeat it for each page:',
      },
      {
        kind: 'steps',
        items: [
          'Set the default behaviour to “Block”. Everything you have not allowed now returns a fault — meaning you are testing the harshest scenario.',
          'Reload the page and look at what stops working. The page probably will not open at all; that is normal.',
          'Allow the EPs the page genuinely needs to come back up. The quickest way is the Allow button in the “Recent failures” list.',
          'Reload again. When the loop settles you have a list of exactly what this page needs to stay standing.',
        ],
      },
      {
        kind: 'p',
        text: 'Before moving to the next page you press Reset; the rule list is cleared and you start the new page from scratch.',
      },
    ],
  },
  {
    title: 'The most common mistake: two different addresses',
    blocks: [
      {
        kind: 'p',
        text: 'The address the application is served from and the address it pulls data from are usually different. You browse panel.company.com, but the data comes from api.company.com.',
      },
      {
        kind: 'p',
        text: 'DR-SIM needs to know both: Domain says which requests to manage, while Active page says which page the extension should run inside. If you see the “Not injected into this page” warning in the panel, press Run on this page and reload.',
      },
      {
        kind: 'note',
        text: 'If nothing is being captured, this is the first place to look.',
      },
    ],
  },
  {
    title: 'Profiles: share your setup',
    blocks: [
      {
        kind: 'p',
        text: 'The scenario you built — which EPs are blocked, which domains are in scope, what the fault type is — can be exported to a single file.',
      },
      {
        kind: 'p',
        text: 'In the panel’s Profile section, download it with “⤒ Export”, send it to a teammate, and they pick it up with “⤓ Import”. You have both run the same test with the same setup. A profile you no longer want can be taken off the list with Remove.',
      },
    ],
  },
  {
    title: 'Reports',
    blocks: [
      {
        kind: 'p',
        text: 'There are two download buttons at the bottom of the panel:',
      },
      {
        kind: 'terms',
        items: [
          {
            term: '⤓ Report MD',
            desc: 'Downloads what was blocked, what passed and a summary of the round as readable text. Ideal for pasting into a note or a ticket; it leaves a blank space for you to write your observation.',
          },
          {
            term: '⤓ Report JSON',
            desc: 'Gives you the raw data: the duration and status code of every request, and all success and failure entries. For feeding another tool or comparing two rounds.',
          },
        ],
      },
    ],
  },
  {
    title: 'If something is not working',
    blocks: [
      {
        kind: 'list',
        items: [
          'No requests show up in the panel: make sure you added the domain and reloaded the page. The extension enters the page as it loads, so a reload is required.',
          'The Chrome permission dialog never appeared: you can grant it by hand from the Site permissions section on this page.',
          'Everything is blocked and the page never opens: that is the expected behaviour, it is the test itself. Move forward by allowing the EPs that are needed; if you want out quickly, flip the switch to OFF.',
          'It says the extension cannot run on this kind of page: no extension can run on the browser’s own pages (those starting with chrome://, the extension store). Switch to an ordinary web page.',
          'The page opens but nothing is being blocked: check in order whether the switch is ON, whether the domain is right, and whether the default behaviour is what you expect.',
        ],
      },
    ],
  },
  {
    title: 'Where does your data go?',
    blocks: [
      {
        kind: 'p',
        text: 'Nowhere. Everything stays on your own computer in the browser’s own storage; DR-SIM never sends any data to any server.',
      },
      {
        kind: 'p',
        text: 'Request headers and bodies are not recorded at all by default. Even if you turn that on in the settings, sensitive fields such as passwords and session keys are masked as they are written.',
      },
    ],
  },
];

export const GUIDE: Record<Locale, GuideChapter[]> = { tr: TR, en: EN };
