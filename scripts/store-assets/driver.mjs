// Ekran görüntüsü sayfasının sürücüsü (tarayıcıda çalışır).
//
// Akış: demo uygulamaya gerçek RuntimeConfig'i ver → interceptor'ın ürettiği
// telemetriyi topla → ürünün KENDİ oturum deposundan geçir → panele gerçek bir
// STATE_SNAPSHOT olarak gönder. Ekranda görünen sayıların hiçbiri elle yazılmaz.
import { APP_ORIGIN, APP_ROUTE, APP_TITLE, OPTIONS_ANCHOR, SCENES } from './scenes.mjs';

export const driverJs = (id, cover = null) => {
  const scene = SCENES[id];
  const focus = cover ? 'dr-sim-inventory' : scene.focus;

  return `// oluşturulan dosya — kaynak: scripts/store-assets/driver.mjs
import {
  DEFAULT_SETTINGS,
  buildResultReport,
  compileConfig,
  createSessionStore,
  createTranslator,
} from '/harness.js';

// Oturum deposu chrome.storage.session'a yazmayı dener; tezgâhta yazacak yer yok.
window.chrome = {
  storage: { session: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
};

const SCENE = ${JSON.stringify(scene.settings)};
const FOCUS = ${JSON.stringify(focus ?? null)};
const KIND = ${JSON.stringify(scene.kind ?? 'app-panel')};
const VARIANT = ${JSON.stringify(scene.variant ?? null)};
const ANCHOR = ${JSON.stringify(OPTIONS_ANCHOR[scene.focus] ?? null)};
const TAB_URL = ${JSON.stringify(`${APP_ORIGIN}${APP_ROUTE}`)};
const TOKEN = ${JSON.stringify(cover ?? id)};
const OFFSET = ${JSON.stringify(cover ? 0 : scene.offset ?? 0)};

const settings = { ...DEFAULT_SETTINGS, ...SCENE };
const t = createTranslator('en');
const config = compileConfig(settings, 1, t);

const store = createSessionStore();
store.setRoute(
  1,
  { origin: ${JSON.stringify(APP_ORIGIN)}, pathname: ${JSON.stringify(APP_ROUTE)}, search: '', hash: '' },
  ${JSON.stringify(APP_TITLE)},
  settings,
);

const app = document.getElementById('app');
const ui = document.getElementById('panel') ?? document.getElementById('options');

const push = () => ui?.contentWindow.postMessage({
  type: 'DRSIM_SCENE_STATE',
  state: {
    settings,
    session: store.get(1),
    tabId: 1,
    tabUrl: TAB_URL,
    supported: true,
    autoOffAt: null,
    notice: null,
    revision: 1,
  },
}, '*');

const focusSection = () => {
  if (KIND === 'options') {
    if (ANCHOR) ui?.contentWindow.postMessage({ type: 'DRSIM_SCROLL_TITLE', title: ANCHOR, offset: OFFSET }, '*');
    return;
  }
  if (FOCUS) ui?.contentWindow.postMessage({ type: 'DRSIM_SCROLL_TEST', test: FOCUS, offset: OFFSET }, '*');
};

// Rapor da ürünün kendi üreticisinden çıkar — ekrandaki metin, "Rapor MD"
// düğmesinin indireceği dosyanın aynısıdır.
const renderReport = () => {
  const doc = document.getElementById('doc');
  const body = document.getElementById('docBody');
  if (!doc || !body) return;

  body.replaceChildren();
  buildResultReport({ session: store.get(1), settings, t, now: Date.now() })
    .split('\\n')
    .forEach((line) => {
      // Markdown vurgusu kaynak dosyada yıldızla yazılır; önizlemede kalın olarak
      // gösterilir, satırın kendisi değişmez.
      const bold = /^\\*\\*+.*\\*\\*+$/.test(line.trim()) || (line.startsWith('**') && line.includes('**', 2));
      const node = bold
        ? Object.assign(document.createElement('b'), { textContent: line.replaceAll('*', '') })
        : document.createTextNode(line);
      body.append(node, document.createTextNode('\\n'));
    });

  const scrim = document.getElementById('scrim');
  if (scrim) scrim.hidden = false;
  doc.hidden = false;
};

let finished = false;
const finish = () => {
  if (finished) return;
  finished = true;
  push();
  setTimeout(() => {
    focusSection();
    if (VARIANT === 'report') renderReport();
    document.documentElement.dataset.shotReady = '1';
    // Sayfanın load olayı bu noktaya kadar bekletiliyor; ekran görüntüsü
    // ancak buradan sonra alınır.
    requestAnimationFrame(() => fetch('/ready?token=' + TOKEN));
  }, 120);
};

let configSent = false;
const sendConfig = () => {
  if (configSent) return;
  configSent = true;
  app?.contentWindow.postMessage({ type: 'DEMO_CONFIG', config }, '*');
};

const handle = (data) => {
  if (!data) return;

  // Panel/ayarlar portu kuruldu — durumu ancak şimdi gönderebiliriz.
  if (data.type === 'HARNESS_UI_READY') {
    push();
    if (KIND === 'options') setTimeout(finish, 60);
    return;
  }

  if (data.type === 'DEMO_READY') {
    sendConfig();
    return;
  }

  if (data.type === 'DEMO_TELEMETRY') {
    store.applyTelemetry(1, data.records, data.dropped, settings);
    push();
    return;
  }

  if (data.type === 'DEMO_DONE') setTimeout(finish, 150);
};

addEventListener('message', (event) => handle(event.data));

// Modül defer'lı yüklendiği için iframe'ler ondan önce konuşmuş olabilir;
// sayfa başındaki tampon kaçan mesajları saklar.
(window.__harnessQueue ?? []).forEach(handle);

// Demo uygulama hazır sinyalini büsbütün kaçırdıysa yine de config'i alsın.
setTimeout(sendConfig, 400);
`;
};
