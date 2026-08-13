import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Extension sayfaları + service worker: ES module çıktısı
export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'ui/side-panel/index': resolve(__dirname, 'src/ui/side-panel/index.html'),
        'ui/options/index': resolve(__dirname, 'src/ui/options/index.html'),
        'ui/guide/index': resolve(__dirname, 'src/ui/guide/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
