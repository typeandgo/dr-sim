import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/types.ts', 'src/core/**/*.spec.ts'],
      thresholds: {
        // core/ hedefi: dosya bazında %100
        perFile: true,
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
