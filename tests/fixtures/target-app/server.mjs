// Bağımlılıksız test hedefi: uygulama :5174, API :5175.
// İki ayrı port, gerçek senaryodaki "uygulama host'u ≠ API host'u" durumunu taklit eder.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_PORT = 5174;
const API_PORT = 5175;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', `http://localhost:${APP_PORT}`);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Expose-Headers', 'x-drsim-simulated');
};

createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html' || req.url?.startsWith('/app/')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(resolve(HERE, 'index.html')));
    return;
  }
  res.writeHead(404).end('not found');
}).listen(APP_PORT, () => {
  console.log(`uygulama : http://localhost:${APP_PORT}`);
});

createServer((req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const path = (req.url ?? '/').split('?')[0];

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, path, method: req.method, at: Date.now() }));
}).listen(API_PORT, () => {
  console.log(`API      : http://localhost:${API_PORT}`);
  console.log('\nDR-SIM panelinde:');
  console.log(`  Domain            → localhost:${API_PORT}`);
  console.log(`  "Bu sayfada çalıştır" → localhost:${APP_PORT} için izin verir`);
});
