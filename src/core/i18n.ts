// Çok dilli metinler — 02-ui-spec.md §4.9.
//
// `chrome.i18n` NEDEN KULLANILMIYOR: tarayıcı arayüz diline kilitlidir ve
// çalışma anında değiştirilemez. Ürün gereksinimi kullanıcıya EN/TR seçimi
// sunmak olduğu için sözlük burada tutulur. `chrome.i18n` yalnızca manifest'in
// name/description alanları için kullanılır (`public/_locales/`) — orada
// tarayıcı dili zaten doğru davranıştır ve başka yolu yoktur.
//
// EN sözlüğü tek doğruluk kaynağıdır: `MessageKey` ondan türetilir, TR ise
// `Record<MessageKey, string>` olduğu için eksik çeviri derleme hatasıdır.

export type Locale = 'en' | 'tr';
export type LocalePreference = 'auto' | Locale;

export const LOCALES: readonly Locale[] = ['en', 'tr'];
export const FALLBACK_LOCALE: Locale = 'en';

export const EN = {
  // --- ortak
  'common.allow': 'Allow',
  'common.settings': 'Settings',
  'common.add': 'Add',
  'common.clear': 'Clear',
  'common.remove': 'Remove',
  'common.delete': 'Delete',
  'common.all': 'All',
  'common.blocked': 'Blocked',
  'common.allowed': 'Allowed',
  'common.none': '(none)',
  'common.rootMissing': 'drsim-root not found',

  // --- header
  'header.on': 'ON',
  'header.off': 'OFF',
  'header.enable': 'Turn simulation on',
  'header.disable': 'Turn simulation off',
  'header.autoOff': 'turns off automatically in {minutes} min',
  'header.productionGuard': 'These domains look like production:\n{domains}\n\nWith the "Block" policy, EVERY request to the domain is cut off. Continue?',
  'header.enableFailed': 'Could not turn the simulation on.',
  'header.toggleFailed': 'Could not change the simulation state.',
  'header.modeOn': 'Simulation on — requests in this tab are being altered',
  'header.modeOff': 'Observation mode — requests are recorded, not blocked',
  'header.unsupported': 'The extension cannot run on this kind of page.',

  // --- kapsam
  'scope.domain': 'Domain',
  'scope.domainHint': 'Which requests are managed (the API host).',
  'scope.domainPlaceholder': 'api.example.com',
  'scope.removeDomain': 'Remove domain',
  'scope.noDomains': 'No requests are managed until you add a domain. Add one above.',
  'scope.addFailed': 'Could not add the domain.',
  'scope.activePage': 'Active page',
  'scope.copyAddress': 'Copy to clipboard',
  'scope.addressCopied': 'Address copied',
  'scope.runHere': 'Run on this page',
  'scope.stopRunningHere': 'Stop running on this page',
  'scope.permissionDenied': 'Permission was not granted for this site. The extension cannot run on this page.',
  'scope.permissionDeniedDomain': 'Permission was not granted for this site. Domain not added — you can also grant it from Settings → Site permissions.',
  'scope.reloadHint': 'Reload the page — the interceptor will be injected into this tab.',
  'scope.pageAddFailed': 'Could not add the page.',
  'scope.notInjected': 'Not injected into this page ({host}) — requests cannot be captured. Grant access with "Run on this page", then reload.',

  // --- politika
  'policy.title': 'Default behaviour',
  'policy.aria': 'Default policy',
  'policy.optionBlock': 'Block',
  'policy.optionPass': 'Pass',
  'policy.reset': 'Reset',
  'policy.resetTitle': 'Clear the rule list — start a new DR round clean',
  'policy.resetConfirm': 'All rules will be deleted and every EP returns to the default behaviour. Continue?',
  'policy.statusBlock': "EPs without a rule are blocked ({fault})",
  'policy.statusPass': "EPs without a rule pass through",
  'policy.ruleCount': '{count} rules',

  // --- arıza
  'fault.networkError': 'network error',
  'fault.timeout': 'timeout after {seconds} s',

  // --- envanter
  'inventory.title': 'Page EP inventory ({blocked} blocked / {total})',
  'inventory.empty': 'No requests yet. Reload the page or interact with it.',
  'inventory.noMatch': 'No EP matches the filter.',
  'inventory.searchPlaceholder': 'search…',
  'inventory.removeRule': 'Delete the rule — the EP returns to the default behaviour',

  // --- loglar
  'log.successTitle': 'Recent successes ({count})',
  'log.failTitle': 'Recent failures ({count})',
  'log.successEmpty': 'No successes yet.',
  'log.failEmpty': 'No failures.',
  'log.filterReal': 'Real',
  'log.filterSimulated': 'Simulated',
  'log.tagSimulated': 'simulated',
  'log.tagReal': 'real',

  // --- etiketler
  'tag.inventory': 'inventory',
  'tag.manual': 'manual',
  'tag.xhr': 'xhr',
  'tag.syncXhr': 'sync XHR',
  'tag.simulatedFail': 'simulated fail',
  'tag.simulated': 'simulated',

  // --- profil
  'profile.title': 'Profile',
  'profile.import': '⤓ Import',
  'profile.export': '⤒ Export',
  'profile.removeTitle': 'Remove the selected profile from the list',
  'profile.select': 'Select',
  'profile.emptyOption': 'No profile — add one with ⤓ Import',
  'profile.applyConfirm': 'The current rule list will be replaced by this profile. Continue?',
  'profile.applyFailed': 'Could not apply the profile.',
  'profile.removeConfirm': 'The profile "{name}" will be removed from the list. Your rules stay unchanged. Continue?',
  'profile.removeFailed': 'Could not remove the profile.',
  'profile.exportFailed': 'Could not export the profile.',
  'profile.importFailed': 'Could not import the profile.',
  'profile.imported': 'Profile added to the list.',
  'profile.importApplyConfirm': 'Profile added to the list. Apply it now? The current rule list will change.',
  'profile.snapshotName': 'DR-SIM profile',

  // --- footer
  'badge.on': 'DR-SIM on — {count} requests blocked',
  'badge.off': 'DR-SIM off',
  'banner.active': 'DR-SIM active — requests in this tab are being altered',

  'footer.language': 'Language',
  'footer.switchTo': 'Switch the interface to {language}',

  'footer.reportMd': 'Report MD',
  'footer.reportJson': 'Report JSON',
  'footer.reportFailed': 'Could not generate the report.',
  'footer.engine': 'engine: {engine} · v{version}',
  'footer.pruned': 'Showing the last {max} entries · {dropped} pruned',
  'footer.showing': 'Showing the last {max} entries',

  // --- bağlantı
  'connection.reconnecting': 'Reconnecting to the background service…',
  'connection.sendFailed': 'Could not send the command.',
  'connection.timeout': 'Timed out.',

  // --- karar sebepleri
  'reason.disabled': 'simulation off',
  'reason.out-of-scope': 'out of scope',
  'reason.allowed': 'allowed',
  'reason.blocked': 'block rule',
  'reason.default-block': 'not in the allow list',
  'reason.default-pass': 'default',
  'reason.real-error': 'real error',
  'reason.sync-xhr': 'sync XHR — out of scope',

  // --- doğrulama hataları (core kod döndürür, UI çevirir)
  'error.domain-empty': 'Domain cannot be empty.',
  'error.domain-invalid': 'Invalid domain. Example: api.example.com or *.example.com/gw',
  'error.path-empty': 'Path cannot be empty.',
  'error.path-wildcard': 'Wildcard rules are not supported, enter the full path.',
  'error.path-invalid': 'Enter a valid path (e.g. /offers/active).',
  'error.invalid-key': 'Invalid EP key.',
  'error.not-found': 'Record not found.',
  'error.invalid-settings': 'Invalid settings.',
  'error.invalid-json': 'Invalid JSON file.',
  'error.profile-schema': 'Does not match the profile schema (no rules list).',
  'error.settings-write': 'Settings could not be saved (storage may be full).',
  'error.settings-read': 'Settings could not be read, defaults restored.',

  // --- ayarlar sayfası
  'options.title': 'DR-SIM — Settings',
  'options.guide': 'Guide — what DR-SIM is and how to use it',
  'options.guideHint': 'Open any chapter you need. Written for first-time users; no technical background required.',
  'options.sample': 'Sample profile',
  'options.sampleHint': 'A ready-made profile file. Download it, adjust the domain and rules to your own application, then load it from the panel with “⤓ Import”.',
  'options.sampleDownload': 'Download the sample',
  'options.sampleCopy': 'Copy',
  'options.sampleCopied': 'Copied to the clipboard.',
  'options.sampleFields': 'Only the “rules” list is required. Every path must be written in normalized form: not /orders/8842/detail but /orders/:id/detail.',
  'sample.name': 'Sample — payment closed',
  'sample.noteAllow': 'needed for login, must stay open',
  'sample.noteNormalized': 'record id normalized with :id',
  'sample.noteBlock': 'the endpoint being tested for the DR scenario',
  'options.fault': 'Fault',
  'options.faultBody': 'Body (JSON)',
  'options.faultDelay': 'Delay (ms)',
  'options.faultTimeout': 'Timeout (ms)',
  'options.faultHint': 'Every blocked request fails this way. The status line in the panel shows the selected type.',
  'options.rules': 'Rules',
  'options.rulesSummary': '{total} rules · {allow} allowed · {block} blocked',
  'options.rulesHint': 'The rule list is global: access you grant on one page also applies on other pages. Bulk reset lives in the panel.',
  'options.rulesEmpty': 'No rules yet.',
  'options.ruleRemove': 'Delete the record — the EP returns to the default behaviour',
  'options.normalization': 'Path normalization',
  'options.numericId': 'Numeric id (/123 → /:id)',
  'options.uuid': 'UUID',
  'options.longHex': 'Long hex (8+ characters)',
  'options.customPatterns': 'One regex per line — e.g. ^u_[a-z0-9]+$',
  'options.capture': 'Capture and privacy',
  'options.captureHeaders': 'Capture headers',
  'options.captureBody': 'Capture body',
  'options.privacyHint': 'When capture is on, fields such as authorization, cookie and token are masked. Data never leaves the device.',
  'options.limits': 'Limits',
  'options.maxLogEntries': 'Max log entries',
  'options.maxInventoryItems': 'Max inventory rows',
  'options.keepInventory': 'Keep inventory across navigation',
  'options.security': 'Security',
  'options.autoOff': 'Auto-off (min) — 0 = disabled',
  'options.autoOffHint': 'Disabled by default: the simulation stays on until you turn it off. If you enter a duration, it turns off automatically after that.',
  'options.productionGuard': 'Production guard',
  'options.showPageBanner': 'Show the page banner',
  'options.productionHosts': 'One host pattern per line — e.g. *.prod.*',
  'options.sitePermissions': 'Site permissions',
  'options.permissionHint': 'If you could not grant permission from the panel, you can do it here. After granting, reload the target page.',
  'options.permissionsEmpty': 'No domain or page added yet.',
  'options.permissionChecking': 'checking…',
  'options.permissionGranted': 'granted',
  'options.permissionPending': 'awaiting permission',
  'options.permissionRefused': 'permission refused',
  'options.language': 'Appearance and language',
  'options.languageLabel': 'Language',
  'options.languageAuto': 'Automatic (browser language)',
  'options.languageHint': 'Automatic follows the browser language; English is used when it is not Turkish.',
  'options.shortcuts': 'Shortcuts',
  'options.editShortcuts': 'Edit shortcuts',
  'options.contact': 'Contact',
  'options.contactHint': 'For questions, suggestions and bug reports: ',

  // --- rapor
  'report.page': 'Page',
  'report.blockedEps': "***Blocked EPs***",
  'report.passedEps': "***Not blocked EPs***",
  'report.output': '***Outcome***',
  'report.observation': '<observation>',
  'report.date': 'Date',
  'report.domainScope': 'Domain scope',
  'report.defaultPolicy': 'Default policy',
  'report.faultType': 'Fault type',
  'report.totalRequests': 'Total requests',
  'report.failBreakdown': 'Failure breakdown',
  'report.failBreakdownValue': '{simulated} simulated · {real} real',
  'report.policyBlock': 'Requests outside the list are blocked',
  'report.policyPass': 'Requests outside the list pass through',
} as const;

export type MessageKey = keyof typeof EN;

export const TR: Record<MessageKey, string> = {
  'common.allow': 'İzin ver',
  'common.settings': 'Ayarlar',
  'common.add': 'Ekle',
  'common.clear': 'Temizle',
  'common.remove': 'Kaldır',
  'common.delete': 'Sil',
  'common.all': 'Tümü',
  'common.blocked': 'Engelli',
  'common.allowed': 'İzinli',
  'common.none': '(yok)',
  'common.rootMissing': 'drsim-root bulunamadı',

  'header.on': 'ON',
  'header.off': 'OFF',
  'header.enable': 'Simülasyonu aç',
  'header.disable': 'Simülasyonu kapat',
  'header.autoOff': '{minutes} dk sonra otomatik kapanır',
  'header.productionGuard': 'Bu domainler production görünüyor:\n{domains}\n\nPolitika "Bloklansın" iken domaine giden HER istek kesilir. Devam edilsin mi?',
  'header.enableFailed': 'Simülasyon açılamadı.',
  'header.toggleFailed': 'Simülasyon durumu değiştirilemedi.',
  'header.modeOn': 'Simülasyon açık — bu sekmedeki istekler değiştiriliyor',
  'header.modeOff': 'Gözlem modu — istekler kaydediliyor, bloklanmıyor',
  'header.unsupported': 'Bu sayfa türünde eklenti çalışamaz.',

  'scope.domain': 'Domain',
  'scope.domainHint': 'Hangi isteklerin yönetileceği (API host’u).',
  'scope.domainPlaceholder': 'api.example.com',
  'scope.removeDomain': 'Domaini kaldır',
  'scope.noDomains': 'Domain girilmeden hiçbir istek yönetilmez. Yukarıdan bir domain ekle.',
  'scope.addFailed': 'Domain eklenemedi.',
  'scope.activePage': 'Aktif sayfa',
  'scope.copyAddress': 'Panoya kopyala',
  'scope.addressCopied': 'Adres kopyalandı',
  'scope.runHere': 'Bu sayfada çalıştır',
  'scope.stopRunningHere': 'Bu sayfada çalıştırmayı bırak',
  'scope.permissionDenied': 'Bu site için izin verilmedi. Eklenti bu sayfada çalışamaz.',
  'scope.permissionDeniedDomain': 'Bu site için izin verilmedi. Domain eklenmedi — Ayarlar → Site izinleri’nden de verebilirsin.',
  'scope.reloadHint': 'Sayfayı yenile — interceptor bu sekmeye enjekte edilecek.',
  'scope.pageAddFailed': 'Sayfa eklenemedi.',
  'scope.notInjected': 'Bu sayfaya ({host}) enjekte edilmiyor — istekler yakalanamaz. "Bu sayfada çalıştır" ile izin ver, sonra sayfayı yenile.',

  'policy.title': 'Varsayılan davranış',
  'policy.aria': 'Varsayılan politika',
  'policy.optionBlock': 'Bloklansın',
  'policy.optionPass': 'Geçsin',
  'policy.reset': 'Sıfırla',
  'policy.resetTitle': 'Kural listesini temizle — yeni bir DR turuna temiz başla',
  'policy.resetConfirm': 'Tüm kurallar silinecek ve her EP varsayılan davranışa dönecek. Devam edilsin mi?',
  'policy.statusBlock': "Kural yazılmayan EP'ler bloklanıyor ({fault})",
  'policy.statusPass': "Kural yazılmayan EP'ler geçiyor",
  'policy.ruleCount': '{count} kural',

  'fault.networkError': 'network error',
  'fault.timeout': '{seconds} sn sonra timeout',

  'inventory.title': 'Sayfa EP Envanteri ({blocked} engelli / {total})',
  'inventory.empty': 'Henüz istek yok. Sayfayı yenile veya etkileşim yap.',
  'inventory.noMatch': 'Filtreyle eşleşen EP yok.',
  'inventory.searchPlaceholder': 'ara…',
  'inventory.removeRule': 'Kuralı sil — EP varsayılan davranışa döner',

  'log.successTitle': 'Son Success’ler ({count})',
  'log.failTitle': 'Son Fail’ler ({count})',
  'log.successEmpty': 'Henüz success yok.',
  'log.failEmpty': 'Fail yok.',
  'log.filterReal': 'Gerçek',
  'log.filterSimulated': 'Simüle',
  'log.tagSimulated': 'simüle',
  'log.tagReal': 'gerçek',

  'tag.inventory': 'envanter',
  'tag.manual': 'manuel',
  'tag.xhr': 'xhr',
  'tag.syncXhr': 'sync XHR',
  'tag.simulatedFail': 'simüle fail',
  'tag.simulated': 'simüle',

  'profile.title': 'Profil',
  'profile.import': '⤓ İçe',
  'profile.export': '⤒ Dışa',
  'profile.removeTitle': 'Seçili profili listeden kaldır',
  'profile.select': 'Seçiniz',
  'profile.emptyOption': 'Profil yok — ⤓ İçe ile ekle',
  'profile.applyConfirm': 'Mevcut kural listesi bu profille değişecek. Devam edilsin mi?',
  'profile.applyFailed': 'Profil uygulanamadı.',
  'profile.removeConfirm': '"{name}" profili listeden kaldırılacak. Kuralların değişmez. Devam edilsin mi?',
  'profile.removeFailed': 'Profil kaldırılamadı.',
  'profile.exportFailed': 'Profil dışa aktarılamadı.',
  'profile.importFailed': 'Profil içe aktarılamadı.',
  'profile.imported': 'Profil listeye eklendi.',
  'profile.importApplyConfirm': 'Profil listeye eklendi. Şimdi uygulansın mı? Mevcut kural listesi değişecek.',
  'profile.snapshotName': 'DR-SIM profili',

  'badge.on': 'DR-SIM açık — {count} istek bloklandı',
  'badge.off': 'DR-SIM kapalı',
  'banner.active': 'DR-SIM aktif — bu sekmedeki istekler değiştiriliyor',

  'footer.language': 'Dil',
  'footer.switchTo': 'Arayüzü {language} diline çevir',

  'footer.reportMd': 'Rapor MD',
  'footer.reportJson': 'Rapor JSON',
  'footer.reportFailed': 'Rapor üretilemedi.',
  'footer.engine': 'motor: {engine} · v{version}',
  'footer.pruned': 'Son {max} kayıt gösteriliyor · {dropped} kayıt budandı',
  'footer.showing': 'Son {max} kayıt gösteriliyor',

  'connection.reconnecting': 'Arka plan servisiyle bağlantı yenileniyor…',
  'connection.sendFailed': 'Komut gönderilemedi.',
  'connection.timeout': 'Zaman aşımı.',

  'reason.disabled': 'simülasyon kapalı',
  'reason.out-of-scope': 'kapsam dışı',
  'reason.allowed': 'izinli',
  'reason.blocked': 'engel kuralı',
  'reason.default-block': 'izin listesinde yok',
  'reason.default-pass': 'varsayılan',
  'reason.real-error': 'gerçek hata',
  'reason.sync-xhr': 'sync XHR — kapsam dışı',

  'error.domain-empty': 'Domain boş olamaz.',
  'error.domain-invalid': 'Geçersiz domain. Örnek: api.example.com veya *.example.com/gw',
  'error.path-empty': 'Path boş olamaz.',
  'error.path-wildcard': 'Joker kural desteklenmiyor, tam path gir.',
  'error.path-invalid': 'Geçerli bir path gir (örn. /offers/active).',
  'error.invalid-key': 'Geçersiz EP anahtarı.',
  'error.not-found': 'Kayıt bulunamadı.',
  'error.invalid-settings': 'Geçersiz ayar.',
  'error.invalid-json': 'Geçersiz JSON dosyası.',
  'error.profile-schema': 'Profil şemasına uymuyor (rules listesi yok).',
  'error.settings-write': 'Ayarlar kaydedilemedi (depolama dolu olabilir).',
  'error.settings-read': 'Ayarlar okunamadı, varsayılanlara dönüldü.',

  'options.title': 'DR-SIM — Ayarlar',
  'options.guide': 'Kılavuz — DR-SIM nedir, nasıl kullanılır?',
  'options.guideHint': 'İhtiyacın olan bölümü aç. İlk kez kullananlar için yazıldı; teknik bilgi gerektirmez.',
  'options.sample': 'Örnek profil',
  'options.sampleHint': 'Hazır bir profil dosyası. İndir, domain ve kuralları kendi uygulamana göre değiştir, sonra panelden “⤓ İçe” ile yükle.',
  'options.sampleDownload': 'Örneği indir',
  'options.sampleCopy': 'Kopyala',
  'options.sampleCopied': 'Panoya kopyalandı.',
  'options.sampleFields': 'Zorunlu olan tek alan “rules” listesidir. Her path normalize edilmiş biçimde yazılmalıdır: /orders/8842/detail değil, /orders/:id/detail.',
  'sample.name': 'Örnek — ödeme kapalı',
  'sample.noteAllow': 'giriş için gerekli, açık kalmalı',
  'sample.noteNormalized': 'kayıt id’si :id ile normalize edildi',
  'sample.noteBlock': 'DR senaryosunda test edilen uç',
  'options.fault': 'Arıza',
  'options.faultBody': 'Gövde (JSON)',
  'options.faultDelay': 'Gecikme (ms)',
  'options.faultTimeout': 'Timeout (ms)',
  'options.faultHint': 'Bloklanan her istek bu şekilde başarısız olur. Paneldeki durum satırı seçili tipi yazar.',
  'options.rules': 'Kurallar',
  'options.rulesSummary': '{total} kural · {allow} izinli · {block} engelli',
  'options.rulesHint': 'Kural listesi globaldir: bir sayfada verdiğin izin diğer sayfalarda da geçerlidir. Toplu sıfırlama panelde.',
  'options.rulesEmpty': 'Henüz kural yok.',
  'options.ruleRemove': 'Kaydı sil — EP varsayılan davranışa döner',
  'options.normalization': 'Path normalizasyonu',
  'options.numericId': 'Sayısal id (/123 → /:id)',
  'options.uuid': 'UUID',
  'options.longHex': 'Uzun hex (8+ karakter)',
  'options.customPatterns': 'Her satıra bir regex — örn. ^u_[a-z0-9]+$',
  'options.capture': 'Yakalama ve gizlilik',
  'options.captureHeaders': 'Header yakala',
  'options.captureBody': 'Body yakala',
  'options.privacyHint': 'Yakalama açıkken authorization, cookie, token gibi alanlar maskelenir. Veri cihazdan çıkmaz.',
  'options.limits': 'Limitler',
  'options.maxLogEntries': 'Max log kaydı',
  'options.maxInventoryItems': 'Max envanter satırı',
  'options.keepInventory': 'Navigasyonda envanteri koru',
  'options.security': 'Güvenlik',
  'options.autoOff': 'Auto-off (dk) — 0 = kapalı',
  'options.autoOffHint': 'Varsayılan kapalı: simülasyon sen kapatana kadar açık kalır. Bir süre girersen o süre sonunda otomatik kapanır.',
  'options.productionGuard': 'Production guard',
  'options.showPageBanner': 'Sayfa bandını göster',
  'options.productionHosts': 'Her satıra bir host pattern — örn. *.prod.*',
  'options.sitePermissions': 'Site izinleri',
  'options.permissionHint': 'Panelden izin veremediysen buradan verebilirsin. İzin verdikten sonra hedef sayfayı yenile.',
  'options.permissionsEmpty': 'Henüz domain veya sayfa eklenmedi.',
  'options.permissionChecking': 'kontrol ediliyor…',
  'options.permissionGranted': 'izinli',
  'options.permissionPending': 'izin bekliyor',
  'options.permissionRefused': 'izin verilmedi',
  'options.language': 'Görünüm ve dil',
  'options.languageLabel': 'Dil',
  'options.languageAuto': 'Otomatik (tarayıcı dili)',
  'options.languageHint': 'Otomatik, tarayıcı dilini izler; Türkçe değilse İngilizce kullanılır.',
  'options.shortcuts': 'Kısayollar',
  'options.editShortcuts': 'Kısayolları düzenle',
  'options.contact': 'İletişim',
  'options.contactHint': 'Soru, öneri ve hata bildirimi için: ',

  'report.page': 'Sayfa',
  'report.blockedEps': "***Bloklanan EP'ler***",
  'report.passedEps': "***Bloklanmayan EP'ler***",
  'report.output': '***Çıktı***',
  'report.observation': '<gözlem>',
  'report.date': 'Tarih',
  'report.domainScope': 'Domain kapsamı',
  'report.defaultPolicy': 'Varsayılan politika',
  'report.faultType': 'Arıza tipi',
  'report.totalRequests': 'Toplam istek',
  'report.failBreakdown': 'Fail dağılımı',
  'report.failBreakdownValue': '{simulated} simüle · {real} gerçek',
  'report.policyBlock': 'Listede olmayanlar bloklanır',
  'report.policyPass': 'Listede olmayanlar geçer',
};

const CATALOG: Record<Locale, Record<MessageKey, string>> = { en: EN, tr: TR };

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

// `{name}` yer tutucuları doldurulur; karşılığı verilmeyen bir yer tutucu
// olduğu gibi kalır — sessizce boş string basmaktansa görünür olsun.
const format = (template: string, params?: Record<string, string | number>): string => (params
  ? template.replace(/\{(\w+)\}/g, (token, name: string) => (name in params ? String(params[name]) : token))
  : template);

export const createTranslator = (locale: Locale): Translate => {
  const messages = CATALOG[locale];
  return (key, params) => format(messages[key], params);
};

// Tarayıcı dili yalnızca tercih 'auto' iken bakılır. Türkçe dışındaki her dil
// İngilizceye düşer (ürün kararı: iki dil desteklenir, fallback EN).
export const resolveLocale = (preference: LocalePreference, uiLanguage: string): Locale => {
  if (preference !== 'auto') return preference;

  const language = uiLanguage.toLowerCase();
  return language === 'tr' || language.startsWith('tr-') ? 'tr' : FALLBACK_LOCALE;
};

// Bilinmeyen anahtar geldiğinde ham kodu göstermek, boş mesaj göstermekten iyidir:
// hata kodları arka plandan gelir ve sözlükte karşılığı olmayan bir kod eklenebilir.
export const isMessageKey = (value: string): value is MessageKey => value in EN;

// Arka plandan gelen mesaj ya doğrudan bir anahtardır ('connection.timeout') ya da
// çıplak bir hata kodudur ('domain-invalid' → 'error.domain-invalid'). İkisi de
// tanınmazsa ham metin gösterilir: sözlükte olmayan bir kodu yutmak yerine göster.
export const describeMessage = (message: string, t: Translate): string => {
  if (isMessageKey(message)) return t(message);

  const errorKey = `error.${message}`;
  return isMessageKey(errorKey) ? t(errorKey) : message;
};
