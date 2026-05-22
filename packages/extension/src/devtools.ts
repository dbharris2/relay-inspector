/**
 * Devtools page entry. Runs once when DevTools opens on a tab and
 * registers the panel that appears in the DevTools tab strip alongside
 * Elements / Console / Network / etc.
 *
 * `panel.html` is a registered Vite entry (extension/vite.config.ts's
 * rollupOptions.input), so it gets emitted at the extension root and
 * Chrome resolves the relative path from there. The icon at
 * icons/icon-32.png ships alongside via the manifest's `icons` field.
 */
chrome.devtools.panels.create(
  'Relay Inspector',
  'icons/icon-32.png',
  'panel.html',
);
