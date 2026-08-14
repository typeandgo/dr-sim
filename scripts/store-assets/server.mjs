// Tezgâh sunucuları: demo uygulama (:7174), demo API (:7175) ve görsel
// tezgâhı (:7180 — dist/ + üretilen sayfalar).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoAppHtml } from './demo-app.mjs';
import { coverHtml, shotHtml, withChromeStub } from './pages.mjs';
import { driverJs } from './driver.mjs';
import { API_PORT, APP_ORIGIN, APP_PORT, APP_ROUTE, HARNESS_PORT } from './scenes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DIST = resolve(ROOT, 'dist');

const VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const send = (res, body, type = 'text/html; charset=utf-8', status = 200) => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
};

// ------------------------------------------------------------------ demo API

// Gerçek gecikmeler: paneldeki "ms" sütunu uydurma değil, ölçülen süredir.
const ENDPOINTS = {
  '/org-users/current': { delay: 42, body: { value: 'operations' } },
  '/offers/active': { delay: 28, body: { count: 12 } },
  '/carts/item-count': { delay: 19, body: { count: 3 } },
  '/messages/unread-message-count': { delay: 33, body: { count: 7 } },
  '/favorites/collections': { delay: 51, body: { count: 4 } },
  '/statistics/visit/count': { delay: 74, body: { count: 1284 } },
  '/invoices/overdue': { delay: 61, body: { count: 2 } },
  '/credit-cards': { delay: 37, body: { count: 2 } },
};

const ORDER_TOTALS = { 8842: '€1,240.00', 9110: '€980.00' };
const orderBody = (id) => ({ value: ORDER_TOTALS[id] ?? '€0.00', id });

const apiServer = () => createServer((req, res) => {
  res.setHeader('access-control-allow-origin', APP_ORIGIN);
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-expose-headers', 'x-drsim-simulated');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const path = (req.url ?? '/').split('?')[0];
  const order = /^\/orders\/(\d+)\/summary$/.exec(path);
  const entry = order ? { delay: 46, body: orderBody(order[1]) } : ENDPOINTS[path];

  if (!entry) {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}');
    return;
  }

  setTimeout(() => {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(entry.body));
  }, entry.delay);
});

// ------------------------------------------------------------- demo uygulama

const appServer = () => {
  const page = demoAppHtml();

  return createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/' || path === APP_ROUTE || path.startsWith('/app/')) {
      send(res, page);
      return;
    }
    res.writeHead(404).end('not found');
  });
};

// ------------------------------------------------------------------- tezgâh

const distFile = (path) => {
  // `..` ile dist dışına çıkılmasın
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, safe);
  if (!file.startsWith(DIST)) return null;
  try {
    return { body: readFileSync(file), type: TYPES[extname(file)] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
};

// Headless Chrome ekran görüntüsünü `load` olayında alır. Sayfa hazır olana
// kadar `load`'u bekletmek için bir görsel isteği açık tutulur; sürücü işini
// bitirince `/ready` çağırır ve görsel iner. `--virtual-time-budget` bu işi
// yapacaktı ama yeni headless'ta bütçe dolmuyor ve süreç asılı kalıyordu.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const HOLD_TIMEOUT_MS = 12_000;

const holds = new Map();

const release = (token) => {
  const pending = holds.get(token);
  if (!pending) return;
  holds.delete(token);
  clearTimeout(pending.timer);
  pending.res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
  pending.res.end(PIXEL);
};

const harnessServer = (harnessBundle) => createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${HARNESS_PORT}`);
  const path = url.pathname;
  const scene = url.searchParams.get('scene') ?? 'loop';

  if (path === '/hold') {
    const token = url.searchParams.get('token') ?? scene;
    release(token);
    holds.set(token, { res, timer: setTimeout(() => release(token), HOLD_TIMEOUT_MS) });
    return;
  }

  if (path === '/ready') {
    release(url.searchParams.get('token') ?? scene);
    send(res, 'ok', 'text/plain; charset=utf-8');
    return;
  }

  if (path === '/harness.js') {
    send(res, harnessBundle, TYPES['.js']);
    return;
  }

  if (path === '/drive.js') {
    send(res, driverJs(scene, url.searchParams.get('cover')), TYPES['.js']);
    return;
  }

  if (path === '/shot') {
    send(res, shotHtml(scene));
    return;
  }

  if (path === '/cover') {
    send(res, coverHtml(url.searchParams.get('id') ?? 'promo-small'));
    return;
  }

  if (path === '/panel' || path === '/options') {
    const source = path === '/panel' ? 'ui/side-panel/index.html' : 'ui/options/index.html';
    const file = distFile(source);
    if (!file) {
      send(res, 'dist/ eksik — önce `npm run build`', 'text/plain; charset=utf-8', 500);
      return;
    }
    send(res, withChromeStub(file.body.toString('utf8'), `${APP_ORIGIN}${APP_ROUTE}`, VERSION));
    return;
  }

  const file = distFile(path);
  if (!file) {
    res.writeHead(404).end('not found');
    return;
  }
  send(res, file.body, file.type);
});

export const startServers = async () => {
  const harnessBundle = readFileSync(resolve(ROOT, 'node_modules/.tmp/dr-sim-store/harness.js'), 'utf8');

  const servers = [
    [appServer(), APP_PORT],
    [apiServer(), API_PORT],
    [harnessServer(harnessBundle), HARNESS_PORT],
  ];

  await Promise.all(servers.map(([server, port]) => new Promise((done, fail) => {
    server.once('error', (error) => fail(
      error.code === 'EADDRINUSE'
        ? new Error(`:${port} dolu — tezgâh bu portu istiyor. Kullanan süreci kapat (lsof -nP -i :${port}).`)
        : error,
    ));
    server.listen(port, done);
  })));

  return () => servers.forEach(([server]) => server.close());
};
