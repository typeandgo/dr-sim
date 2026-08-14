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
      ['/carts/offer', FULL],
      ['/carts/current', FULL],
      ['/carts/current/status', FULL],
      ['/carts/current/completed', FULL],
      ['/carts/current/complete', FULL],
      ['/carts/current/single-pay-complete', FULL],
      ['/carts/item-count', FULL],
      ['/cart-offers/{id}', FULL],
      ['/cart-packages/{id}', FULL],
      ['/cart-items/{id}', FULL],
      ['/cart-items/{id}', FULL],
      ['/cart-promotions/apply-promotion', FULL],
      ['/cart-promotions/remove-promotion', FULL],
      ['/cart-reservations/{id}', FULL],
      ['/discounts/payment', FULL],
      ['/payments/contour', FULL],
      ['/payments/free', FULL],
      ['/payments', FULL],
      ['/payments/options', FULL],
      ['/payments/monthly-summary', FULL],
      ['/payments/logs', FULL],
      ['/payments/failed-logs', FULL],
      ['/bank-accounts', FULL],
      ['/order-details', FULL],
      ['/offers/active', FULL],
      ['/offers', FULL],
      ['/offers/{id}/detail', FULL],
      ['/offers/renewals-or-online-offers', FULL],
      ['/offer-promotions/check-user-discounts', FULL],
      ['/products/member-club', FULL],
      // Kredi Kartı / Sanal POS / Taksit
      ['/card-info', FULL],
      ['/credit-cards', FULL],
      ['/credit-cards/{cardId}', FULL],
      ['/credit-cards/card-list', FULL],
      ['/credit-card-sessions', FULL],
      ['/payments/card-installment-info', FULL],
      ['/payments/three-d-callback', FULL],
      ['/payments/add-card', FULL],
      ['/payments/loyalties', FULL],
      ['/operations/{paymentId}/installments', FULL],
      ['/operations/{paymentId}/installment-list', FULL],
      ['/payment-installments/options', FULL],
      ['/payment-installments/waiting-payments', FULL],
      ['/payment-installments/waiting-payments', FULL],
      ['/payment-installments/active-package-payments', FULL],
      ['/payment-installments/active-installments', FULL],
      ['/payment-installments/retry-policy-properties', FULL],
      ['/payment-installments/payment/{paymentId}/installment-no/{installmentNo}', FULL],
      ['/webhooks/gateway', FULL],
      // Kısmen çalışmayacak
      ['/carts', PARTIAL],
      ['/carts/package', PARTIAL],
      ['/carts/product-unit', PARTIAL],
      ['/carts/member-club', PARTIAL],
      ['/payments/three-d', PARTIAL],
      ['/payments/non-three-d', PARTIAL],
      ['/payments/token', PARTIAL],
      ['/payments/bank-transfer', PARTIAL],
      ['/payments/add-card-ivr', PARTIAL],
      ['/payments/add-card-ivr/v2', PARTIAL],
      ['/partial-installments/three-d', PARTIAL],
      ['/partial-installments/token', PARTIAL],
    ],
  },
  {
    id: 'dr-fatura-sozlesme-raporlama',
    name: 'DR — Fatura, sözleşme ve raporlama',
    file: 'dr-fatura-sozlesme-raporlama.json',
    rows: [
      // Fatura / Sözleşme
      ['/invoices', FULL],
      ['/invoices/{invoiceId}/download', FULL],
      ['/contracts', FULL],
      ['/contracts', FULL],
      ['/contracts/count', FULL],
      ['/contracts/{id}', FULL],
      ['/contracts/{id}', FULL],
      ['/contracts/{id}/preview', FULL],
      ['/contracts/{id}/download', FULL],
      ['/contracts/{id}/file', FULL],
      ['/contracts/{id}/orgs', FULL],
      ['/contracts/{id}/users', FULL],
      ['/contracts/{id}/items', FULL],
      ['/contracts/{id}/lease-info', FULL],
      ['/contracts/{id}/general-conditions', FULL],
      ['/contracts/{id}/partner', FULL],
      ['/contracts/{id}/complete', FULL],
      ['/digital-contract/active', FULL],
      ['/digital-contract', FULL],
      ['/digital-contract/{status}', FULL],
      ['/digital-contract/{contractId}/accept', FULL],
      ['/digital-contract/{contractId}/update/{paymentId}', FULL],
      ['/digital-contract/{id}/show', FULL],
      ['/digital-contract/{id}/show/accepted', FULL],
      ['/digital-contract/show/accepted-contracts-user', FULL],
      // İstatistik / Raporlar
      ['/statistics/visit/count', FULL],
      ['/statistics/call/count', FULL],
      ['/statistics/message/count', FULL],
      ['/statistics/favorite/count', FULL],
      ['/statistics/published-item/count', FULL],
      ['/statistics/viewed-items', FULL],
      ['/statistics/price-index', FULL],
      ['/item-statistics/favorite', FULL],
      ['/item-statistics/message', FULL],
      ['/item-statistics/visit', FULL],
      ['/item-statistics/messenger', FULL],
      ['/item-statistics/call', FULL],
      ['/item-statistics/total-message', FULL],
      ['/dashboard/favorite-statistics', FULL],
      ['/dashboard/org-statistics', FULL],
      ['/dashboard/message-statistics', FULL],
      ['/top-items', FULL],
      ['/benchmark-report/average-visit-count', FULL],
      ['/benchmark-report/average-item-count', FULL],
      ['/benchmark-report/region-activity', FULL],
      ['/benchmark-report/benchmark-level', FULL],
      ['/boost-statistics/social-boost', FULL],
      ['/boost-statistics/ad-booster', FULL],
      // Kısmen çalışmayacak
      ['/sales-agreements/current', PARTIAL],
      ['/sales-agreements', PARTIAL],
    ],
  },
  {
    id: 'dr-hesap-mesaj-icerik',
    name: 'DR — Hesap, mesaj ve içerik',
    file: 'dr-hesap-mesaj-icerik.json',
    rows: [
      // Mesajlar / Bildirimler / Favoriler / Aramalar
      ['/messages/v2/message-box', FULL],
      ['/messages/v2', FULL],
      ['/messages/v2', FULL],
      ['/messages/set-messages-as-read', FULL],
      ['/messages/message-box/v2', FULL],
      ['/messages/unread-message-count', FULL],
      ['/user-block', FULL],
      ['/user-block', FULL],
      ['/user-block', FULL],
      ['/org-user-notifications', FULL],
      ['/org-user-notifications/count', FULL],
      ['/org-user-notifications/{id}/mark-as-read', FULL],
      ['/favorites', FULL],
      ['/favorites/collections', FULL],
      ['/favorites/collections/favorite', FULL],
      ['/saved-search', FULL],
      ['/suggestions', FULL],
      // Boost
      ['/boosts/histories', FULL],
      ['/boosts/products', FULL],
      ['/boosts/count', FULL],
      // Hesap / Organizasyon / Diğer
      ['/org-users/current/email', FULL],
      ['/org-users/current/resendActivationEmail', FULL],
      ['/org-users/{id}/resend-activation-email', FULL],
      ['/org-branches', FULL],
      ['/org-branches', FULL],
      ['/org-branches/status', FULL],
      ['/sso', FULL],
      ['/sso/member-club', FULL],
      ['/url-shortener/member-club', FULL],
      ['/partner-market/reference', FULL],
      ['/items/{listingId}/summary', FULL],
      ['/items/item-valuation', FULL],
      // Kısmen çalışmayacak
      ['/boost-product-usage', PARTIAL],
      ['/items/{itemId}/publish-with-boost', PARTIAL],
      ['/items/{itemId}/location/verify-permit', PARTIAL],
      ['/products/banner', PARTIAL],
      ['/dashboard/account-manager-info', PARTIAL],
      ['/org-users/leads', PARTIAL],
      ['/boost-products/product-subs/free', PARTIAL],
    ],
  },
];

// §C.2: {param} → :id. Method yok (Revizyon 59): bir path'in tek durumu vardır.
// Bu üç senaryonun hepsi defaultPolicy "pass" + hepsi block olduğu için çıktı
// yalnızca `block` listesi taşır; `allow` boş kalır.
const toPath = (path) => path.replace(/\{[^}]+\}/g, ':id');

const FAULT = {
  kind: 'http',
  status: 503,
  statusText: 'Service Unavailable',
  body: '{"message":"DR simulated unavailable"}',
  headers: {},
  delayMs: 0,
  timeoutMs: 30000,
};

const buildPreset = (preset) => ({
  name: preset.name,
  defaultPolicy: 'pass',
  domains: [],
  allow: [],
  block: [...new Set(preset.rows.map(([path]) => toPath(path)))],
  fault: FAULT,
});

// Path çakışması bir preset'in içinde de, presetler arasında da rapor edilir:
// aynı EP iki dosyada olursa ikisini birden içe aktaran kullanıcıda son yazan kazanır.
const seenGlobal = new Map();

mkdirSync(OUT_DIR, { recursive: true });

PRESETS.forEach(({ file, ...preset }) => {
  const output = buildPreset(preset);

  output.block.forEach((path) => {
    if (seenGlobal.has(path)) console.warn(`çakışan (paylaşılan) path: ${seenGlobal.get(path)} ↔ ${file}: ${path}`);
    seenGlobal.set(path, file);
  });

  const out = resolve(OUT_DIR, file);
  writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`preset üretildi: ${String(output.block.length).padStart(3)} path → ${out}`);
});

console.log(`toplam ${seenGlobal.size} benzersiz path`);
