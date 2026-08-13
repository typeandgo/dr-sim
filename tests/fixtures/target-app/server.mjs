// Bağımlılıksız test hedefi. İki ayrı port, gerçek senaryodaki
// "uygulama host'u ≠ API host'u" durumunu taklit eder.
//
// Portlar env ile değiştirilebilir — çakışma olursa ya da izinleri temiz bir
// host'la yeniden denemek istersen dosyaya dokunmaya gerek yok:
//   DRSIM_APP_PORT=8300 DRSIM_API_PORT=8301 npm run fixture
//
// Chrome, verilen site erişimini HOST bazında tutar ve port'u yok sayar
// (`*://localhost/*`). Yani port değiştirmek izni sıfırlamaz; localhost için
// verdiğin erişim tüm portları kapsar.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const port = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} geçersiz: ${process.env[name]}`);
  }
  return value;
};

const APP_PORT = port('DRSIM_APP_PORT', 7174);
const API_PORT = port('DRSIM_API_PORT', 7175);

// Sayfa portları derleme anında değil, sunum anında öğrenir
const page = readFileSync(resolve(HERE, 'index.html'), 'utf8')
  .replaceAll('__APP_PORT__', String(APP_PORT))
  .replaceAll('__API_PORT__', String(API_PORT));

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', `http://localhost:${APP_PORT}`);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Expose-Headers', 'x-drsim-simulated');
};

createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html' || req.url?.startsWith('/app/')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
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
  console.log(`  Domain → localhost:${API_PORT}`);
  console.log(`  İzin dialogu ${APP_PORT} ve ${API_PORT} portlarını birlikte kapsar (Chrome port'u yok sayar).`);
  console.log('\nBaşka port: DRSIM_APP_PORT=8300 DRSIM_API_PORT=8301 npm run fixture');
});
