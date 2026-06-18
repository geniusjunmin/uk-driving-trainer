import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@dimforge/rapier3d-compat': resolve(__dirname, './node_modules/@dimforge/rapier3d-compat/rapier.es.js')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts'],
    passWithNoTests: false
  }
});
