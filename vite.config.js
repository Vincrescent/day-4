import { defineConfig } from 'vite';

// Medieval 3D Chess — Vite config
// Root = project folder. `public/` holds assets. `src/` holds the game code.
export default defineConfig({
  base: './',
  server: {
    port: 4000,
    open: false,
    host: true,
  },
  preview: {
    port: 4000,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 8 * 1024, // keep small textures inline
    chunkSizeWarningLimit: 1200,
  },
});
