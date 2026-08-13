import { PORT_NAMES, SW_MESSAGES } from '@/core/constants';
import { MESSAGE_TYPES, createRateLimiter, validateInboundMessage } from '@/core/message.schema';
import type { RuntimeConfig } from '@/core/types';

// ISOLATED world köprüsü — 01-architecture.md §4.1/§4.2.
// Sayfadan gelen hiçbir veri `chrome.*` çağrılarına ham parametre olmaz;
// yalnızca şema doğrulamasından geçmiş alanlar iletilir.

const BANNER_ID = 'drsim-page-banner';
const MAX_BACKOFF_MS = 30_000;

const channelToken = crypto.randomUUID();
const allowMessage = createRateLimiter();

let port: chrome.runtime.Port | null = null;
let backoffMs = 500;
let lastConfig: RuntimeConfig | null = null;
let reconnectTimer: number | null = null;

const postToMain = (payload: Record<string, unknown>): void => {
  window.postMessage({ ...payload, __drsim: channelToken }, window.location.origin);
};

const sendInit = (): void => {
  window.postMessage({ type: MESSAGE_TYPES.INIT, token: channelToken }, window.location.origin);
  if (lastConfig) postToMain({ type: MESSAGE_TYPES.CONFIG, config: lastConfig });
};

// --------------------------------------------------------------- sayfa bandı

const removeBanner = (): void => {
  document.getElementById(BANNER_ID)?.remove();
};

// Shadow DOM: sayfanın stilini ve JS'ini kirletmez (04 §4.2)
const renderBanner = (): void => {
  if (document.getElementById(BANNER_ID)) return;
  if (!document.documentElement) return;

  const host = document.createElement('div');
  host.id = BANNER_ID;
  host.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;';

  const shadow = host.attachShadow({ mode: 'closed' });
  const bar = document.createElement('div');
  bar.textContent = 'DR-SIM aktif — bu sekmedeki istekler değiştiriliyor';
  bar.style.cssText = [
    'font:600 11px/18px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
    'background:#b91c1c',
    'color:#fecaca',
    'text-align:center',
    'letter-spacing:0.03em',
  ].join(';');
  shadow.appendChild(bar);
  document.documentElement.appendChild(host);
};

const syncBanner = (config: RuntimeConfig | null): void => {
  try {
    if (config?.enabled && config.showPageBanner && config.domains.length) renderBanner();
    else removeBanner();
  } catch {
    // sayfa DOM'u beklenmedik durumdaysa banner atlanır
  }
};

// ------------------------------------------------------------ SW bağlantısı

const handleSwMessage = (message: unknown): void => {
  const data = message as { type?: string; config?: RuntimeConfig };
  if (data?.type !== SW_MESSAGES.CONFIG_UPDATED || !data.config) return;

  lastConfig = data.config;
  postToMain({ type: MESSAGE_TYPES.CONFIG, config: data.config });
  syncBanner(data.config);
};

const scheduleReconnect = (): void => {
  if (reconnectTimer !== null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
};

function connect(): void {
  try {
    port = chrome.runtime.connect({ name: PORT_NAMES.CONTENT });
  } catch {
    port = null;
    scheduleReconnect();
    return;
  }

  backoffMs = 500;
  port.onMessage.addListener(handleSwMessage);
  port.onDisconnect.addListener(() => {
    port = null;
    scheduleReconnect();
  });

  send({ type: SW_MESSAGES.CONTENT_READY, href: window.location.href });
}

function send(payload: Record<string, unknown>): void {
  if (!port) {
    scheduleReconnect();
    return;
  }
  try {
    port.postMessage(payload);
  } catch {
    port = null;
    scheduleReconnect();
  }
}

// ------------------------------------------------------- MAIN world mesajları

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.origin !== window.location.origin) return;

  const raw = event.data as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return;

  // El sıkışma: MAIN önce yüklendiyse READY ile token ister
  if (raw.type === MESSAGE_TYPES.READY && raw.__drsim === 'handshake') {
    sendInit();
    return;
  }

  if (!allowMessage(Date.now())) return;

  const message = validateInboundMessage(raw, channelToken);
  if (!message) return;

  if (message.type === MESSAGE_TYPES.TELEMETRY) {
    if (!message.records.length && !message.dropped) return;
    send({ type: SW_MESSAGES.TELEMETRY_BATCH, records: message.records, dropped: message.dropped });
    return;
  }

  if (message.type === MESSAGE_TYPES.ROUTE) {
    send({ type: SW_MESSAGES.ROUTE_CHANGE, route: message.route, title: document.title });
  }
});

window.addEventListener('pagehide', () => {
  try {
    port?.disconnect();
  } catch {
    // yok say
  }
});

sendInit();
connect();
