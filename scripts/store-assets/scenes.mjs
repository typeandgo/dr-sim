// Mağaza görsellerinin senaryoları. Hem Node (sunucu) hem tarayıcı (tezgâh
// sayfaları) bu dosyayı import eder; bu yüzden bağımlılıksız düz ESM'dir.

export const APP_PORT = 7174;
export const API_PORT = 7175;
export const HARNESS_PORT = 7180;

export const APP_ORIGIN = `http://localhost:${APP_PORT}`;
export const API_ORIGIN = `http://localhost:${API_PORT}`;

export const APP_ROUTE = '/app/orders';
export const APP_TITLE = 'Demo Console';

// Demo uygulamanın kartları. Her kart tek bir endpoint'e bağlıdır; istek
// GERÇEKTEN atılır ve DR-SIM'in gerçek interceptor'ı tarafından kesilir.
export const WIDGETS = [
  { id: 'user', label: 'Signed in as', path: '/org-users/current', field: 'value' },
  { id: 'offers', label: 'Active offers', path: '/offers/active', field: 'count' },
  { id: 'cart', label: 'Items in cart', path: '/carts/item-count', field: 'count' },
  { id: 'messages', label: 'Unread messages', path: '/messages/unread-message-count', field: 'count' },
  { id: 'favorites', label: 'Collections', path: '/favorites/collections', field: 'count' },
  { id: 'visits', label: 'Visits today', path: '/statistics/visit/count', field: 'count' },
  { id: 'invoices', label: 'Overdue invoices', path: '/invoices/overdue', field: 'count' },
  { id: 'cards', label: 'Saved cards', path: '/credit-cards', field: 'count', xhr: true },
  // Aynı EP'nin iki farklı id'si: envanterde /orders/:id/summary olarak tek satır
  { id: 'order-a', label: 'Order 8842', path: '/orders/8842/summary', field: 'value' },
  { id: 'order-b', label: 'Order 9110', path: '/orders/9110/summary', field: 'value' },
];

// Sayfanın ayakta kalması için gereken üç endpoint. "Son Fail'ler"deki İzin ver
// döngüsünün sonunda kullanıcının varacağı liste tam olarak budur.
const ALLOWED = ['/org-users/current', '/offers/active', '/carts/item-count'];

const rules = (paths, state) => paths.map((path, index) => ({
  path,
  state,
  createdAt: 1_770_000_000_000 + index,
}));

const domain = (pattern) => ({ id: `d-${pattern}`, pattern, granted: true });

const baseSettings = (patch = {}) => ({
  enabled: false,
  defaultPolicy: 'block',
  domains: [domain(`localhost:${API_PORT}`)],
  pageHosts: [domain(`localhost:${APP_PORT}`)],
  rules: [],
  ...patch,
});

export const SCENES = {
  // 1 — kahraman kare: ürünün ana döngüsü tek bakışta
  loop: {
    kind: 'app-panel',
    caption: 'Turn it on — everything you have not allowed fails',
    sub: 'Real requests, cut off in your own browser. The server is never touched, no other user is affected.',
    settings: baseSettings({ enabled: true, rules: rules(ALLOWED, 'allow') }),
    focus: 'dr-sim-inventory',
    file: '01-simulate-failures',
  },

  // 2 — gözlem modu: simülasyon kapalıyken bile envanter dolar
  inventory: {
    caption: 'It watches before it breaks anything',
    sub: 'Add the API domain and the inventory fills from real traffic — while the simulation is still off.',
    settings: baseSettings(),
    focus: null,
    file: '02-live-inventory',
  },

  // 3 — arıza seçimi (Ayarlar sayfası)
  fault: {
    kind: 'options',
    caption: 'Choose how the backend fails',
    sub: 'A 503 with a body you control, a network error, or a request that never answers.',
    settings: baseSettings({ enabled: true, rules: rules(ALLOWED, 'allow') }),
    focus: 'fault',
    callouts: [
      { tone: 'danger', title: '503 with your own body', text: 'Status, status text and JSON body are yours. Reproduce the exact payload your gateway returns.' },
      { tone: 'warning', title: 'Network error or timeout', text: 'Fail the request the way a dropped connection does — or let it hang until the app gives up.' },
      { tone: 'info', title: 'Delay before the fault', text: 'Add latency first, then fail. This is how a slow backend actually behaves under load.' },
      { tone: 'accent', title: '/orders/8842 and /orders/9110 are one endpoint', text: 'Path normalization folds numeric ids, UUIDs and long hex into :id, so the inventory stays readable.' },
    ],
    file: '03-fault-and-normalization',
  },

  // 4 — profil paylaşımı + rapor çıktısı
  report: {
    kind: 'app-panel',
    variant: 'report',
    caption: 'Share the setup, export the result',
    sub: 'A profile file reproduces the same drill on a teammate’s machine. The report goes straight into the ticket.',
    settings: baseSettings({
      enabled: true,
      rules: rules(ALLOWED, 'allow'),
      profiles: [
        {
          id: 'p-checkout',
          name: 'Checkout — payment outage',
          defaultPolicy: 'block',
          domains: [`localhost:${API_PORT}`],
          allow: ALLOWED,
          block: [],
          updatedAt: 1_770_000_000_000,
        },
      ],
      activeProfileId: 'p-checkout',
    }),
    focus: 'dr-sim-profile-select',
    file: '04-profiles-and-reports',
  },

  // 5 — gizlilik ve izinler (Ayarlar sayfası)
  privacy: {
    kind: 'options',
    caption: 'Nothing leaves your device',
    sub: 'No analytics, no telemetry, no remote code — and no host permission at install time.',
    settings: baseSettings({ enabled: false, rules: rules(ALLOWED, 'allow') }),
    focus: 'capture',
    callouts: [
      { tone: 'accent', title: 'Header capture is off by default', text: 'When you turn it on, authorization, cookie and token fields are masked before anything is written.' },
      { tone: 'info', title: 'Request bodies are never recorded', text: 'Not stored, not masked, not written — the surface simply does not exist.' },
      { tone: 'warning', title: 'Production guard', text: 'Domains that look like production ask for confirmation before the simulation is switched on.' },
      { tone: 'danger', title: 'No host permissions in the manifest', text: 'Access is requested at runtime, in your own click, only for the domain you type.' },
    ],
    file: '05-privacy-and-permissions',
  },
};

export const COVERS = {
  'promo-small': { width: 440, height: 280, file: 'cover-small-tile-440x280' },
  marquee: { width: 1400, height: 560, file: 'cover-marquee-1400x560' },
};

export const SHOT_WIDTH = 1280;
export const SHOT_HEIGHT = 800;

// Ayar sayfasının hangi bölüme kaydırılacağı — başlık metniyle bulunur.
export const OPTIONS_ANCHOR = {
  fault: 'Fault',
  capture: 'Capture and privacy',
};

export const sceneIds = () => Object.keys(SCENES);
