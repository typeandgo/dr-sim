// Üç geçişli build: (1) SW + UI sayfaları ESM, (2)/(3) content script'ler IIFE.
// MAIN world'de ES module import çalışmadığı için content script'ler ayrı derlenir.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

// manifest.version tek kaynaktan (package.json) senkronlanır
const syncManifestVersion = () => {
  const manifestPath = resolve(ROOT, 'public/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== pkg.version) {
    manifest.version = pkg.version;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
};

const contentConfig = (name, entry) => ({
  root: ROOT,
  configFile: false,
  // manifest/ikonlar yalnızca ana build tarafından kopyalanır
  publicDir: false,
  resolve: { alias: { '@': resolve(ROOT, 'src') } },
  build: {
    outDir: resolve(ROOT, 'dist/content'),
    emptyOutDir: false,
    target: 'chrome116',
    sourcemap: false,
    watch: watch ? {} : null,
    lib: {
      entry: resolve(ROOT, entry),
      name: `drsim_${name.replace(/[^a-z0-9]/gi, '_')}`,
      formats: ['iife'],
      fileName: () => `${name}.js`,
    },
  },
});

syncManifestVersion();

await build({ configFile: resolve(ROOT, 'vite.config.ts'), build: { watch: watch ? {} : null } });
await build(contentConfig('interceptor.main', 'src/content/interceptor.main.ts'));
await build(contentConfig('bridge.content', 'src/content/bridge.content.ts'));

if (!watch) {
  console.log('\nBuild hazır: dist/ — chrome://extensions → "Load unpacked" → dist/');
}
