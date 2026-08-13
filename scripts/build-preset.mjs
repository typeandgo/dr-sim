// 07-preset-and-templates.md §C.1 listesini §C.2 kurallarıyla preset JSON'larına çevirir.
// Kaynak liste bu script içinde gömülüdür (orijinal repo bağımlılığı yoktur).
// Revizyon 34: tek 150 kurallık dosya yerine üç ayrı senaryo dosyası üretilir ve
// hiçbiri eklentiye gömülmez — kullanıcı istediğini elle içe aktarır.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'src/presets');

const FULL = 'full';
const PARTIAL = 'partial';

const PRESETS = [
  {
    id: 'dr-odeme-ve-satin-alma',
    name: 'DR — Ödeme ve satın alma',
    file: 'dr-odeme-ve-satin-alma.json',
    rows: [
      // Sepet / Ödeme / Satın Alma
      ['POST', '/carts/offer', FULL],
      ['GET', '/carts/current', FULL],
      ['PUT', '/carts/current/status', FULL],
      ['GET', '/carts/current/completed', FULL],
      ['POST', '/carts/current/complete', FULL],
      ['POST', '/carts/current/single-pay-complete', FULL],
      ['GET', '/carts/item-count', FULL],
      ['DELETE', '/cart-offers/{id}', FULL],
      ['DELETE', '/cart-packages/{id}', FULL],
      ['DELETE', '/cart-items/{id}', FULL],
      ['PUT', '/cart-items/{id}', FULL],
      ['POST', '/cart-promotions/apply-promotion', FULL],
      ['POST', '/cart-promotions/remove-promotion', FULL],
      ['DELETE', '/cart-reservations/{id}', FULL],
      ['GET', '/discounts/payment', FULL],
      ['POST', '/payments/contour', FULL],
      ['POST', '/payments/free', FULL],
      ['GET', '/payments', FULL],
      ['GET', '/payments/options', FULL],
      ['GET', '/payments/monthly-summary', FULL],
      ['GET', '/payments/logs', FULL],
      ['GET', '/payments/failed-logs', FULL],
      ['GET', '/bank-accounts', FULL],
      ['GET', '/order-details', FULL],
      ['GET', '/offers/active', FULL],
      ['GET', '/offers', FULL],
      ['GET', '/offers/{id}/detail', FULL],
      ['GET', '/offers/renewals-or-online-offers', FULL],
      ['GET', '/offer-promotions/check-user-discounts', FULL],
      ['GET', '/products/member-club', FULL],
      // Kredi Kartı / Sanal POS / Taksit
      ['GET', '/card-info', FULL],
      ['GET', '/credit-cards', FULL],
      ['DELETE', '/credit-cards/{cardId}', FULL],
      ['GET', '/credit-cards/card-list', FULL],
      ['POST', '/credit-card-sessions', FULL],
      ['GET', '/payments/card-installment-info', FULL],
      ['POST', '/payments/three-d-callback', FULL],
      ['POST', '/payments/add-card', FULL],
      ['POST', '/payments/loyalties', FULL],
      ['GET', '/operations/{paymentId}/installments', FULL],
      ['GET', '/operations/{paymentId}/installment-list', FULL],
      ['GET', '/payment-installments/options', FULL],
      ['GET', '/payment-installments/waiting-payments', FULL],
      ['POST', '/payment-installments/waiting-payments', FULL],
      ['GET', '/payment-installments/active-package-payments', FULL],
      ['GET', '/payment-installments/active-installments', FULL],
      ['GET', '/payment-installments/retry-policy-properties', FULL],
      ['POST', '/payment-installments/payment/{paymentId}/installment-no/{installmentNo}', FULL],
      ['POST', '/webhooks/gateway', FULL],
      // Kısmen çalışmayacak
      ['POST', '/carts', PARTIAL],
      ['POST', '/carts/package', PARTIAL],
      ['POST', '/carts/product-unit', PARTIAL],
      ['POST', '/carts/member-club', PARTIAL],
      ['POST', '/payments/three-d', PARTIAL],
      ['POST', '/payments/non-three-d', PARTIAL],
      ['POST', '/payments/token', PARTIAL],
      ['POST', '/payments/bank-transfer', PARTIAL],
      ['POST', '/payments/add-card-ivr', PARTIAL],
      ['POST', '/payments/add-card-ivr/v2', PARTIAL],
      ['POST', '/partial-installments/three-d', PARTIAL],
      ['POST', '/partial-installments/token', PARTIAL],
    ],
  },
  {
    id: 'dr-fatura-sozlesme-raporlama',
    name: 'DR — Fatura, sözleşme ve raporlama',
    file: 'dr-fatura-sozlesme-raporlama.json',
    rows: [
      // Fatura / Sözleşme
      ['GET', '/invoices', FULL],
      ['GET', '/invoices/{invoiceId}/download', FULL],
      ['POST', '/contracts', FULL],
      ['GET', '/contracts', FULL],
      ['GET', '/contracts/count', FULL],
      ['GET', '/contracts/{id}', FULL],
      ['DELETE', '/contracts/{id}', FULL],
      ['GET', '/contracts/{id}/preview', FULL],
      ['GET', '/contracts/{id}/download', FULL],
      ['POST', '/contracts/{id}/file', FULL],
      ['PUT', '/contracts/{id}/orgs', FULL],
      ['PUT', '/contracts/{id}/users', FULL],
      ['PUT', '/contracts/{id}/items', FULL],
      ['PUT', '/contracts/{id}/lease-info', FULL],
      ['PUT', '/contracts/{id}/general-conditions', FULL],
      ['PUT', '/contracts/{id}/partner', FULL],
      ['PUT', '/contracts/{id}/complete', FULL],
      ['GET', '/digital-contract/active', FULL],
      ['POST', '/digital-contract', FULL],
      ['POST', '/digital-contract/{status}', FULL],
      ['PUT', '/digital-contract/{contractId}/accept', FULL],
      ['PUT', '/digital-contract/{contractId}/update/{paymentId}', FULL],
      ['GET', '/digital-contract/{id}/show', FULL],
      ['GET', '/digital-contract/{id}/show/accepted', FULL],
      ['GET', '/digital-contract/show/accepted-contracts-user', FULL],
      // İstatistik / Raporlar
      ['GET', '/statistics/visit/count', FULL],
      ['GET', '/statistics/call/count', FULL],
      ['GET', '/statistics/message/count', FULL],
      ['GET', '/statistics/favorite/count', FULL],
      ['GET', '/statistics/published-item/count', FULL],
      ['GET', '/statistics/viewed-items', FULL],
      ['GET', '/statistics/price-index', FULL],
      ['GET', '/item-statistics/favorite', FULL],
      ['GET', '/item-statistics/message', FULL],
      ['GET', '/item-statistics/visit', FULL],
      ['GET', '/item-statistics/messenger', FULL],
      ['GET', '/item-statistics/call', FULL],
      ['GET', '/item-statistics/total-message', FULL],
      ['GET', '/dashboard/favorite-statistics', FULL],
      ['GET', '/dashboard/org-statistics', FULL],
      ['GET', '/dashboard/message-statistics', FULL],
      ['GET', '/top-items', FULL],
      ['POST', '/benchmark-report/average-visit-count', FULL],
      ['POST', '/benchmark-report/average-item-count', FULL],
      ['POST', '/benchmark-report/region-activity', FULL],
      ['POST', '/benchmark-report/benchmark-level', FULL],
      ['GET', '/boost-statistics/social-boost', FULL],
      ['GET', '/boost-statistics/ad-booster', FULL],
      // Kısmen çalışmayacak
      ['GET', '/sales-agreements/current', PARTIAL],
      ['GET', '/sales-agreements', PARTIAL],
    ],
  },
  {
    id: 'dr-hesap-mesaj-icerik',
    name: 'DR — Hesap, mesaj ve içerik',
    file: 'dr-hesap-mesaj-icerik.json',
    rows: [
      // Mesajlar / Bildirimler / Favoriler / Aramalar
      ['GET', '/messages/v2/message-box', FULL],
      ['GET', '/messages/v2', FULL],
      ['POST', '/messages/v2', FULL],
      ['PUT', '/messages/set-messages-as-read', FULL],
      ['DELETE', '/messages/message-box/v2', FULL],
      ['GET', '/messages/unread-message-count', FULL],
      ['GET', '/user-block', FULL],
      ['POST', '/user-block', FULL],
      ['DELETE', '/user-block', FULL],
      ['GET', '/org-user-notifications', FULL],
      ['GET', '/org-user-notifications/count', FULL],
      ['PUT', '/org-user-notifications/{id}/mark-as-read', FULL],
      ['GET', '/favorites', FULL],
      ['GET', '/favorites/collections', FULL],
      ['GET', '/favorites/collections/favorite', FULL],
      ['GET', '/saved-search', FULL],
      ['GET', '/suggestions', FULL],
      // Boost
      ['GET', '/boosts/histories', FULL],
      ['GET', '/boosts/products', FULL],
      ['GET', '/boosts/count', FULL],
      // Hesap / Organizasyon / Diğer
      ['PUT', '/org-users/current/email', FULL],
      ['GET', '/org-users/current/resendActivationEmail', FULL],
      ['POST', '/org-users/{id}/resend-activation-email', FULL],
      ['GET', '/org-branches', FULL],
      ['POST', '/org-branches', FULL],
      ['PUT', '/org-branches/status', FULL],
      ['GET', '/sso', FULL],
      ['GET', '/sso/member-club', FULL],
      ['POST', '/url-shortener/member-club', FULL],
      ['POST', '/partner-market/reference', FULL],
      ['GET', '/items/{listingId}/summary', FULL],
      ['POST', '/items/item-valuation', FULL],
      // Kısmen çalışmayacak
      ['POST', '/boost-product-usage', PARTIAL],
      ['PUT', '/items/{itemId}/publish-with-boost', PARTIAL],
      ['PUT', '/items/{itemId}/location/verify-permit', PARTIAL],
      ['GET', '/products/banner', PARTIAL],
      ['GET', '/dashboard/account-manager-info', PARTIAL],
      ['POST', '/org-users/leads', PARTIAL],
      ['GET', '/boost-products/product-subs/free', PARTIAL],
    ],
  },
];

// §C.2: {param} → :id, state block, source preset, severity → note
const toPresetRule = ([method, rawPath, severity]) => {
  const path = rawPath.replace(/\{[^}]+\}/g, ':id');
  return {
    key: `${method} ${path}`,
    method,
    path,
    state: 'block',
    source: 'preset',
    note: severity === FULL ? 'DR: tamamen kapalı' : 'DR: kısmen kapalı',
    createdAt: 0,
  };
};

const FAULT = {
  kind: 'http',
  status: 503,
  statusText: 'Service Unavailable',
  body: '{"message":"DR simulated unavailable"}',
  headers: {},
  delayMs: 0,
  timeoutMs: 30000,
};

// Anahtar çakışması bir preset'in içinde de, presetler arasında da rapor edilir:
// aynı EP iki dosyada olursa ikisini birden içe aktaran kullanıcıda son yazan kazanır.
const seenGlobal = new Map();
const duplicates = [];

mkdirSync(OUT_DIR, { recursive: true });

PRESETS.forEach(({ id, name, file, rows }) => {
  const seen = new Map();

  rows.map(toPresetRule).forEach((rule) => {
    if (seen.has(rule.key)) {
      duplicates.push(`${file}: ${rule.key}`);
      return;
    }
    if (seenGlobal.has(rule.key)) duplicates.push(`${seenGlobal.get(rule.key)} ↔ ${file}: ${rule.key}`);
    seen.set(rule.key, rule);
    seenGlobal.set(rule.key, file);
  });

  const preset = {
    id,
    name,
    defaultPolicy: 'pass',
    domains: [],
    fault: FAULT,
    rules: [...seen.values()],
    updatedAt: 0,
  };

  const out = resolve(OUT_DIR, file);
  writeFileSync(out, `${JSON.stringify(preset, null, 2)}\n`);
  console.log(`preset üretildi: ${String(preset.rules.length).padStart(3)} kural → ${out}`);
});

console.log(`toplam ${seenGlobal.size} benzersiz EP`);
if (duplicates.length) {
  console.warn(`çakışan (tekilleştirilen) anahtarlar:\n  ${duplicates.join('\n  ')}`);
}
