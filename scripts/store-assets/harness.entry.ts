// Mağaza görsel tezgâhının ürüne açılan penceresi.
//
// Ekran görüntülerinde panelin GERÇEK kodu çalışır; bu dosya da onun beslendiği
// veriyi ürünün kendi modülleriyle üretir: config derleme, telemetri → oturum
// indirgemesi ve rapor metni. Tezgâh bunları yeniden yazsaydı ekran görüntüsü
// ürünü değil, ürünün taklidini gösterirdi.
export { DEFAULT_FAULT, DEFAULT_SETTINGS } from '@/core/constants';
export { compileConfig } from '@/core/compile-config';
export { createTranslator } from '@/core/i18n';
export { buildResultReport } from '@/core/report.builder';
export { createSessionStore } from '@/background/stores/session.store';
