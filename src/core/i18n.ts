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
  // Domain chip'indeki buton "Allow" DEĞİL: Son Fail'lerdeki hızlı izin de öyle
  // yazıyordu ve ikisi bir arada görününce hangisinin ne yaptığı anlaşılmıyordu.
  // Bu buton site erişimi ister, endpoint'e izin vermez.
  'scope.grantAccess': 'Grant access',
  'scope.grantAccessTitle': 'Ask Chrome for access to this site again',
  'scope.permissionLost': 'Access to the marked domain was withdrawn — its requests are not being managed. Restore it with “Grant access”, then reload the page.',
  'scope.addFailed': 'Could not add the domain.',
  'scope.activePage': 'Active page',
  'scope.copyAddress': 'Copy to clipboard',
  'scope.addressCopied': 'Address copied',
  'scope.runHere': 'Run on this page',
  'scope.stopRunningHere': 'Stop running on this page',
  'scope.permissionDenied': 'Permission was not granted for this site. The extension cannot run on this page.',
  'scope.permissionDeniedDomain': 'Permission was not granted for this site, so the domain was not added. Add it again and choose “Allow” in the Chrome dialog.',
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
  'inventory.filterAria': 'EP filter',
  'inventory.removeRule': 'Delete the rule — the EP returns to the default behaviour',

  // --- loglar
  'log.successTitle': 'Recent successes ({count})',
  'log.failTitle': 'Recent failures ({count})',
  'log.successEmpty': 'No successes yet.',
  'log.failEmpty': 'No failures.',
  'log.filterAria': 'Source filter',
  'log.filterReal': 'Real',
  'log.filterSimulated': 'Simulated',
  'log.tagSimulated': 'simulated',
  'log.tagReal': 'real',

  // --- etiketler
  'tag.page': 'page',
  'tag.profile': 'profile',
  'tag.xhr': 'xhr',
  'tag.syncXhr': 'sync XHR',
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
  'profile.importedName': 'Imported profile',

  // --- dosya adları (arayüz diliyle aynı; ASCII slug'a çevrilir)
  'file.profile': 'dr-sim-profile',
  'file.report': 'dr-sim-report',
  'file.untitled': 'untitled',

  // --- footer
  'badge.on': 'DR-SIM on — {count} requests blocked',
  'badge.off': 'DR-SIM off',
  'banner.active': 'DR-SIM active — requests in this tab are being altered',

  'footer.language': 'Language',
  'footer.switchTo': 'Switch the interface to {language}',

  'footer.reportMd': 'Report MD',
  'footer.reportJson': 'Report JSON',
  'footer.reportFailed': 'Could not generate the report.',
  // Motor adı ekrandan kaldırıldı: tek motor var, seçilebilir değil ve kullanıcıya
  // var olmayan seçeneklerin ipucunu veriyordu. Geriye sürüm kaldı.
  'footer.version': 'v{version}',
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
  'error.domain-duplicate': 'This domain is already on the list.',
  'error.path-empty': 'Path cannot be empty.',
  'error.path-wildcard': 'Wildcard rules are not supported, enter the full path.',
  'error.path-invalid': 'Enter a valid path (e.g. /offers/active).',
  'error.not-found': 'Record not found.',
  'error.invalid-settings': 'Invalid settings.',
  'error.invalid-json': 'Invalid JSON file.',
  'error.profile-schema': 'Does not match the profile schema (no allow or block list).',
  'error.settings-write': 'Settings could not be saved (storage may be full).',
  'error.settings-read': 'Settings could not be read, defaults restored.',
  'error.settings-reset': 'This version uses a new settings format. Your previous setup was cleared — add your domain and rules again.',

  // --- ayarlar sayfası
  'options.title': 'DR-SIM — Settings',
  // --- kılavuz sayfası (ayrı sekmede açılır)
  'guide.open': 'Guide',
  'guide.openTitle': 'Open the guide on GitHub in a new tab',
  'options.guide': 'What DR-SIM is and how to use it',
  'options.guideHint': 'The guide and the sample profile file live in the project repository, so this page stays a place for settings. It opens in a new tab.',

  'options.fault': 'Fault',
  'options.faultKind': 'Fault type',
  'options.faultBody': 'Body (JSON)',
  'options.faultBodyHint': 'The response body returned for a blocked request. Only used by the HTTP fault type; ignored for network error and timeout.',
  'options.faultDelay': 'Delay (ms)',
  'options.faultDelayHint': 'How long to wait before the fault is returned. Use it to reproduce a slow backend; 0 fails instantly.',
  'options.faultTimeout': 'Timeout (ms)',
  'options.faultTimeoutHint': 'How long the request hangs before it gives up. Only used by the timeout fault type.',
  'options.faultHint': 'Every blocked request fails this way. The status line in the panel shows the selected type.',
  'options.rules': 'Rules',
  'options.rulesSummary': '{total} rules · {allow} allowed · {block} blocked',
  'options.rulesHint': 'The rule list is global: access you grant on one page also applies on other pages. Bulk reset lives in the panel.',
  'options.rulesEmpty': 'No rules yet.',
  'options.ruleRemove': 'Delete the record — the EP returns to the default behaviour',
  'options.normalization': 'Path normalization',
  'options.normalizationHint': 'Variable path segments are reduced to :id so that /orders/8842 and /orders/9001 count as one EP. The line at the bottom shows the result live.',
  'options.numericId': 'Numeric id (/123 → /:id)',
  'options.numericIdHint': 'Groups purely numeric path segments. Without it every record id becomes a separate EP and the inventory floods.',
  'options.uuid': 'UUID',
  'options.uuidHint': 'Groups segments in UUID form (8-4-4-4-12).',
  'options.longHex': 'Long hex (8+ characters)',
  'options.longHexHint': 'Groups hexadecimal segments of 8 characters or more — MongoDB ids and similar.',
  'options.customPatterns': 'One regex per line — e.g. ^u_[a-z0-9]+$',
  'options.customPatternsHint': 'For id shapes the three options above do not catch — slugs, tenant codes. A segment that matches becomes :id; an invalid line is ignored.',
  'options.capture': 'Capture and privacy',
  'options.captureHeaders': 'Capture headers',
  'options.privacyHint': 'When header capture is on, fields such as authorization, cookie and token are masked before being written. Request bodies are never recorded. Data never leaves the device.',
  'options.limits': 'Limits',
  'options.maxLogEntries': 'Max log entries',
  'options.maxLogEntriesHint': 'How many entries the Recent successes and Recent failures lists keep. Older ones are dropped; the panel reports how many.',
  'options.maxInventoryItems': 'Max inventory rows',
  'options.maxInventoryItemsHint': 'The upper bound on the page EP inventory. When it is hit the least recently seen EP is dropped.',
  'options.keepInventory': 'Keep inventory across navigation',
  'options.keepInventoryHint': 'The inventory is normally cleared on every page load. With this on it is kept, and a “Clear” button appears in the panel’s inventory section — that button is then the only way to empty it.',
  'options.security': 'Security',
  'options.autoOff': 'Auto-off (min) — 0 = disabled',
  'options.autoOffHint': 'Disabled by default: the simulation stays on until you turn it off. If you enter a duration, it turns off automatically after that.',
  'options.productionGuard': 'Production guard',
  'options.productionGuardHint': 'Before the simulation is switched on, your domains are checked against the patterns below. On a match the panel asks for confirmation first — it slows you down, it does not stop you.',
  'options.showPageBanner': 'Show the page banner',
  'options.showPageBannerHint': 'Draws a bar on top of the tested page while the simulation is on, so a simulated failure is never mistaken for a real one. It only appears when a domain is in scope.',
  'options.productionHosts': 'One host pattern per line — e.g. *.prod.*',
  'options.productionHostsHint': 'Which hosts the guard treats as production. One pattern per line, * is a wildcard. Only in effect while the guard is on.',
  'options.language': 'Appearance and language',
  'options.languageLabel': 'Language',
  'options.languageAuto': 'Automatic (browser language)',
  'options.languageHint': 'Automatic follows the browser language; English is used when it is not Turkish.',
  'options.shortcuts': 'Shortcuts',
  'options.shortcutsHint': 'The simulation can be toggled without opening the panel. The default is Alt+Shift+D; Chrome manages the binding.',
  'options.editShortcuts': 'Edit shortcuts',
  // --- sıfırlama (geri alınamaz)
  'options.reset': 'Reset everything',
  'options.resetHint': 'Returns the extension to the state it was in right after installation: rules, domains, profiles, fault settings, limits, language preference, the inventory and logs of every tab, and the site access you granted. There is no undo.',
  'options.resetButton': 'Reset the extension',
  'options.resetConfirm': 'EVERYTHING will be deleted:\n\n• all rules and domains\n• all saved profiles\n• fault settings, limits, language preference\n• the inventory and logs of every tab\n• the site access you granted\n\nThis cannot be undone. Continue?',
  'options.resetDone': 'Everything has been reset. Reload any open target pages.',
  'options.resetPartial': 'Settings were cleared, but Chrome kept site access for: {origins}. Until you remove it from chrome://extensions → Site access, the permission dialog will not appear again for those hosts.',
  'options.resetFailed': 'Could not reset.',

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
  'scope.grantAccess': 'Erişim ver',
  'scope.grantAccessTitle': 'Bu site için Chrome’dan erişimi yeniden iste',
  'scope.permissionLost': 'İşaretli domain için erişim geri alınmış — istekleri yönetilmiyor. “Erişim ver” ile geri kazandır, sonra sayfayı yenile.',
  'scope.addFailed': 'Domain eklenemedi.',
  'scope.activePage': 'Aktif sayfa',
  'scope.copyAddress': 'Panoya kopyala',
  'scope.addressCopied': 'Adres kopyalandı',
  'scope.runHere': 'Bu sayfada çalıştır',
  'scope.stopRunningHere': 'Bu sayfada çalıştırmayı bırak',
  'scope.permissionDenied': 'Bu site için izin verilmedi. Eklenti bu sayfada çalışamaz.',
  'scope.permissionDeniedDomain': 'Bu site için izin verilmedi, domain eklenmedi. Tekrar ekle ve Chrome’un sorduğu izni onayla.',
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
  'inventory.filterAria': 'EP filtresi',
  'inventory.removeRule': 'Kuralı sil — EP varsayılan davranışa döner',

  'log.successTitle': 'Son Success’ler ({count})',
  'log.failTitle': 'Son Fail’ler ({count})',
  'log.successEmpty': 'Henüz success yok.',
  'log.failEmpty': 'Fail yok.',
  'log.filterAria': 'Kaynak filtresi',
  'log.filterReal': 'Gerçek',
  'log.filterSimulated': 'Simüle',
  'log.tagSimulated': 'simüle',
  'log.tagReal': 'gerçek',

  'tag.page': 'sayfa',
  'tag.profile': 'profil',
  'tag.xhr': 'xhr',
  'tag.syncXhr': 'sync XHR',
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
  'profile.importedName': 'İçe aktarılan profil',

  'file.profile': 'dr-sim-profil',
  'file.report': 'dr-sim-rapor',
  'file.untitled': 'adsiz',

  'badge.on': 'DR-SIM açık — {count} istek bloklandı',
  'badge.off': 'DR-SIM kapalı',
  'banner.active': 'DR-SIM aktif — bu sekmedeki istekler değiştiriliyor',

  'footer.language': 'Dil',
  'footer.switchTo': 'Arayüzü {language} diline çevir',

  'footer.reportMd': 'Rapor MD',
  'footer.reportJson': 'Rapor JSON',
  'footer.reportFailed': 'Rapor üretilemedi.',
  'footer.version': 'v{version}',
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
  'error.domain-duplicate': 'Bu domain zaten ekli.',
  'error.path-empty': 'Path boş olamaz.',
  'error.path-wildcard': 'Joker kural desteklenmiyor, tam path gir.',
  'error.path-invalid': 'Geçerli bir path gir (örn. /offers/active).',
  'error.not-found': 'Kayıt bulunamadı.',
  'error.invalid-settings': 'Geçersiz ayar.',
  'error.invalid-json': 'Geçersiz JSON dosyası.',
  'error.profile-schema': 'Profil şemasına uymuyor (allow veya block listesi yok).',
  'error.settings-write': 'Ayarlar kaydedilemedi (depolama dolu olabilir).',
  'error.settings-read': 'Ayarlar okunamadı, varsayılanlara dönüldü.',
  'error.settings-reset': 'Bu sürüm yeni bir ayar biçimi kullanıyor. Önceki kurulumun temizlendi — domain ve kurallarını yeniden ekle.',

  'options.title': 'DR-SIM — Ayarlar',
  'guide.open': 'Kılavuz',
  'guide.openTitle': 'Kılavuzu GitHub’da yeni sekmede aç',
  'options.guide': 'DR-SIM nedir, nasıl kullanılır?',
  'options.guideHint': 'Kılavuz ve örnek profil dosyası proje deposunda; burası ayar yapılan yer olarak kalsın diye. Yeni sekmede açılır.',

  'options.fault': 'Arıza',
  'options.faultKind': 'Arıza tipi',
  'options.faultBody': 'Gövde (JSON)',
  'options.faultBodyHint': 'Bloklanan isteğe dönen cevap gövdesi. Yalnızca HTTP arıza tipinde kullanılır; ağ hatası ve timeout’ta yok sayılır.',
  'options.faultDelay': 'Gecikme (ms)',
  'options.faultDelayHint': 'Arıza dönmeden önce ne kadar beklenecek. Yavaş backend’i taklit etmek için; 0 anında düşürür.',
  'options.faultTimeout': 'Timeout (ms)',
  'options.faultTimeoutHint': 'İstek pes etmeden önce ne kadar asılı kalacak. Yalnızca timeout arıza tipinde kullanılır.',
  'options.faultHint': 'Bloklanan her istek bu şekilde başarısız olur. Paneldeki durum satırı seçili tipi yazar.',
  'options.rules': 'Kurallar',
  'options.rulesSummary': '{total} kural · {allow} izinli · {block} engelli',
  'options.rulesHint': 'Kural listesi globaldir: bir sayfada verdiğin izin diğer sayfalarda da geçerlidir. Toplu sıfırlama panelde.',
  'options.rulesEmpty': 'Henüz kural yok.',
  'options.ruleRemove': 'Kaydı sil — EP varsayılan davranışa döner',
  'options.normalization': 'Path normalizasyonu',
  'options.normalizationHint': 'Değişken path segmentleri :id’ye indirilir; böylece /orders/8842 ile /orders/9001 tek bir EP sayılır. Alttaki satır sonucu canlı gösterir.',
  'options.numericId': 'Sayısal id (/123 → /:id)',
  'options.numericIdHint': 'Tamamen sayıdan oluşan segmentleri gruplar. Kapalıyken her kayıt id’si ayrı bir EP olur ve envanter dolup taşar.',
  'options.uuid': 'UUID',
  'options.uuidHint': 'UUID biçimindeki segmentleri gruplar (8-4-4-4-12).',
  'options.longHex': 'Uzun hex (8+ karakter)',
  'options.longHexHint': '8 karakter ve üzeri onaltılık segmentleri gruplar — MongoDB id’leri ve benzerleri.',
  'options.customPatterns': 'Her satıra bir regex — örn. ^u_[a-z0-9]+$',
  'options.customPatternsHint': 'Yukarıdaki üç seçeneğin yakalayamadığı id biçimleri için — slug’lar, tenant kodları. Eşleşen segment :id olur; geçersiz satır yok sayılır.',
  'options.capture': 'Yakalama ve gizlilik',
  'options.captureHeaders': 'Header yakala',
  'options.privacyHint': 'Header yakalama açıkken authorization, cookie, token gibi alanlar yazılmadan önce maskelenir. İstek gövdeleri hiçbir zaman kaydedilmez. Veri cihazdan çıkmaz.',
  'options.limits': 'Limitler',
  'options.maxLogEntries': 'Max log kaydı',
  'options.maxLogEntriesHint': 'Son Success’ler ve Son Fail’ler listelerinin kaç kayıt tutacağı. Eskiler düşer; panel kaç tanesinin düştüğünü yazar.',
  'options.maxInventoryItems': 'Max envanter satırı',
  'options.maxInventoryItemsHint': 'Sayfa EP envanterinin üst sınırı. Sınıra gelindiğinde en uzun süredir görülmeyen EP düşer.',
  'options.keepInventory': 'Navigasyonda envanteri koru',
  'options.keepInventoryHint': 'Envanter normalde her sayfa yüklemesinde temizlenir. Bu seçenek açıkken korunur ve panelin envanter bölümünde “Temizle” düğmesi belirir — envanteri boşaltmanın tek yolu o düğmedir.',
  'options.security': 'Güvenlik',
  'options.autoOff': 'Auto-off (dk) — 0 = kapalı',
  'options.autoOffHint': 'Varsayılan kapalı: simülasyon sen kapatana kadar açık kalır. Bir süre girersen o süre sonunda otomatik kapanır.',
  'options.productionGuard': 'Production guard',
  'options.productionGuardHint': 'Simülasyon açılmadan önce domainlerin aşağıdaki pattern’lerle karşılaştırılır. Eşleşme varsa panel önce onay ister — engellemez, yavaşlatır.',
  'options.showPageBanner': 'Sayfa bandını göster',
  'options.showPageBannerHint': 'Simülasyon açıkken test edilen sayfanın üstüne bir bant çizer; simüle bir hata gerçek sanılmasın diye. Yalnızca kapsamda domain varken görünür.',
  'options.productionHosts': 'Her satıra bir host pattern — örn. *.prod.*',
  'options.productionHostsHint': 'Guard’ın hangi host’ları canlı sayacağı. Satır başına bir pattern, * joker. Yalnızca guard açıkken geçerli.',
  'options.language': 'Görünüm ve dil',
  'options.languageLabel': 'Dil',
  'options.languageAuto': 'Otomatik (tarayıcı dili)',
  'options.languageHint': 'Otomatik, tarayıcı dilini izler; Türkçe değilse İngilizce kullanılır.',
  'options.shortcuts': 'Kısayollar',
  'options.shortcutsHint': 'Simülasyon paneli açmadan da açılıp kapatılabilir. Varsayılan Alt+Shift+D; bağlamayı Chrome yönetir.',
  'options.editShortcuts': 'Kısayolları düzenle',
  'options.reset': 'Her şeyi sıfırla',
  'options.resetHint': 'Eklentiyi kurulumdan hemen sonraki hâline döndürür: kurallar, domainler, profiller, arıza ayarı, limitler, dil tercihi, tüm sekmelerin envanteri ve logları, verdiğin site erişimleri. Geri alınamaz.',
  'options.resetButton': 'Eklentiyi sıfırla',
  'options.resetConfirm': 'HER ŞEY silinecek:\n\n• tüm kurallar ve domainler\n• kayıtlı tüm profiller\n• arıza ayarı, limitler, dil tercihi\n• tüm sekmelerin envanteri ve logları\n• verdiğin site erişimleri\n\nBu geri alınamaz. Devam edilsin mi?',
  'options.resetDone': 'Her şey sıfırlandı. Açık hedef sayfaları yenile.',
  'options.resetPartial': 'Ayarlar temizlendi ama Chrome şu host’lar için site erişimini korudu: {origins}. chrome://extensions → Site erişimi’nden kaldırmadan bu host’lar için izin penceresi bir daha açılmaz.',
  'options.resetFailed': 'Sıfırlanamadı.',

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
