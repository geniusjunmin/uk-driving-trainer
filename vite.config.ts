import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  build: {
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 2600,
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/three/') || id.includes('\\three\\')) {
            return 'vendor-three';
          }

          if (id.includes('/@dimforge/rapier3d-compat/') || id.includes('\\@dimforge\\rapier3d-compat\\')) {
            return 'vendor-rapier';
          }

          return 'vendor';
        }
      }
    },
    target: 'es2022'
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  }
});
