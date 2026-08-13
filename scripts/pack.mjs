// dist/ klasörünü sürüm etiketli zip'e paketler (source map içermez)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(ROOT, 'dist');

if (!existsSync(dist)) {
  throw new Error('dist/ yok — önce `npm run build` çalıştır.');
}

const { version } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const out = resolve(ROOT, `dr-sim-${version}.zip`);

execFileSync('zip', ['-r', '-q', out, '.', '-x', '*.map'], { cwd: dist });

console.log(`paket hazır: ${out}`);
