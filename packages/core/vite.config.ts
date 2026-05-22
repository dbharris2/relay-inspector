import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Builds the "core" bundle — the JS file loaded into the user's app
 * during development. Output is a self-contained IIFE so it can be
 * loaded via a plain <script src="..."> tag with no module loader.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    lib: {
      entry: fileURLToPath(new URL('./src/iife.ts', import.meta.url)),
      name: 'RelayInspector',
      formats: ['iife'],
      fileName: () => 'core.js',
    },
    rollupOptions: {
      output: { extend: true },
    },
  },
});
