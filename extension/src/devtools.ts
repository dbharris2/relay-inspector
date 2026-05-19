/**
 * Devtools page entry. Runs once when DevTools opens on a tab and
 * registers the panel that appears in the DevTools tab strip alongside
 * Elements / Console / Network / etc.
 *
 * `panel.html` is a registered Vite entry (extension/vite.config.ts's
 * rollupOptions.input), so it gets emitted at the extension root and
 * Chrome resolves the relative path from there.
 */
chrome.devtools.panels.create(
  'Relay Inspector',
  // No custom icon yet; Chrome shows a default placeholder.
  '',
  'panel.html',
);
