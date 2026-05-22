import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import manifest from './manifest.json' with { type: 'json' };

/**
 * Build config for the Chrome-extension deploy. Produces a folder
 * (dist/) that can be loaded as an unpacked extension or zipped for
 * Chrome Web Store submission.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Tell Vite to treat panel.html as an HTML entry so it walks
        // the <script> inside it and bundles panel.tsx + UI deps.
        // devtools.html is picked up automatically via the manifest's
        // devtools_page field; panel.html is referenced at runtime via
        // chrome.devtools.panels.create, which CRXJS can't infer.
        panel: fileURLToPath(new URL('./panel.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
