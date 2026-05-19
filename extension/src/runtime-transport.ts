import type { CoreToUi } from '~/shared/protocol';
import type { IncomingTransport } from '~/ui/transport';

/**
 * Inspector messages from the user's page reach the devtools panel via
 *
 *   page  ──[window.postMessage]──►  content script
 *         ──[chrome.runtime.connect port]──►  service worker
 *         ──[chrome.runtime.connect port]──►  devtools panel
 *
 * This transport is the panel-side endpoint of that chain. The panel
 * opens a long-lived port to the service worker, names it with the
 * inspected tab id, then waits for messages.
 *
 * For now this is a stub that reports a steady 'closed' status — the
 * service-worker routing lands in the next change. It exists so the
 * panel can render and the manifest/extension scaffold can be verified
 * end-to-end in Chrome.
 */
export function createRuntimeTransport(): IncomingTransport {
  return {
    subscribe(handler) {
      handler.onStatus('closed');
      void (handler.onMessage satisfies (msg: CoreToUi) => void);
      return () => {};
    },
  };
}
