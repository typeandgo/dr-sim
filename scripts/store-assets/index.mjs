// Chrome Web Store görsellerini üretir.
//
//   npm run store:assets            → hepsi
//   npm run store:assets -- loop    → yalnızca verilen senaryo/kapak
//
// Ekran görüntüleri 2× çözünürlükte alınır ve `sips` ile mağazanın istediği
// ölçüye indirilir; metin böylece 1280×800'de de keskin kalır.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { startServers } from './server.mjs';
import {
  COVERS,
  HARNESS_PORT,
  SCENES,
  SHOT_HEIGHT,
  SHOT_WIDTH,
} from './scenes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = resolve(ROOT, 'store-assets');
const BUNDLE_DIR = resolve(ROOT, 'node_modules/.tmp/dr-sim-store');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
];

const chromeBinary = () => {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) throw new Error(`Chrome bulunamadı. Denenen yollar:\n${CHROME_CANDIDATES.join('\n')}`);
  return found;
};

// Ürünün gerçek modülleri (config derleme, oturum indirgeme, rapor) tarayıcıya
// tek dosya olarak taşınır.
const buildHarness = async () => {
  await build({
    root: ROOT,
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    resolve: { alias: { '@': resolve(ROOT, 'src') } },
    build: {
      outDir: BUNDLE_DIR,
      emptyOutDir: true,
      target: 'chrome116',
      sourcemap: false,
      lib: {
        entry: resolve(HERE, 'harness.entry.ts'),
        formats: ['es'],
        fileName: () => 'harness.js',
      },
    },
  });
};

const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

// Headless Chrome kareyi yazıyor ama süreç kendiliğinden kapanmıyor; dosya
// oluşup boyutu sabitlenince süreci biz sonlandırıyoruz.
const settled = async (file, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  let previous = -1;

  while (Date.now() < deadline) {
    await sleep(250);
    let size = -1;
    try {
      size = statSync(file).size;
    } catch {
      continue;
    }
    if (size > 0 && size === previous) return true;
    previous = size;
  }
  return false;
};

const capture = async (chrome, url, file, width, height, profile) => {
  const raw = `${file}.2x.png`;
  rmSync(raw, { force: true });

  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--user-data-dir=${profile}`,
    '--force-device-scale-factor=2',
    `--window-size=${width},${height}`,
    `--screenshot=${raw}`,
    url,
  ], { stdio: 'ignore' });

  const ok = await settled(raw, 60_000);
  child.kill('SIGKILL');
  if (!ok) throw new Error(`Ekran görüntüsü alınamadı: ${url}`);

  // 2× kareyi mağazanın beklediği ölçüye indir (sips: önce yükseklik, sonra en)
  execFileSync('/usr/bin/sips', ['-z', String(height), String(width), raw, '--out', file], { stdio: 'ignore' });
  rmSync(raw, { force: true });
};

const run = async () => {
  const only = process.argv.slice(2).filter((argument) => !argument.startsWith('-'));

  if (!existsSync(resolve(ROOT, 'dist/ui/side-panel/index.html'))) {
    throw new Error('dist/ hazır değil — önce `npm run build` çalıştır.');
  }

  await buildHarness();

  mkdirSync(OUT, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'dr-sim-shot-'));
  const chrome = chromeBinary();
  const stop = await startServers();

  const jobs = [
    ...Object.entries(SCENES).map(([id, scene]) => ({
      id,
      file: scene.file,
      url: `http://localhost:${HARNESS_PORT}/shot?scene=${id}`,
      width: SHOT_WIDTH,
      height: SHOT_HEIGHT,
    })),
    ...Object.entries(COVERS).map(([id, cover]) => ({
      id,
      file: cover.file,
      url: `http://localhost:${HARNESS_PORT}/cover?id=${id}`,
      width: cover.width,
      height: cover.height,
    })),
  ].filter((job) => !only.length || only.includes(job.id));

  try {
    for (const job of jobs) {
      const target = resolve(OUT, `${job.file}.png`);
      await capture(chrome, job.url, target, job.width, job.height, profile);
      console.log(`✓ ${job.file}.png  ${job.width}×${job.height}`);
    }
  } finally {
    stop();
    rmSync(profile, { recursive: true, force: true });
  }

  console.log(`\nGörseller hazır: ${OUT}`);
};

await run();
