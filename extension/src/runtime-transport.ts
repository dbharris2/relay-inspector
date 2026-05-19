import type { CoreToUi } from '~/shared/protocol';
import type { IncomingTransport } from '~/ui/transport';

/**
 * Devtools-panel side of the message chain:
 *
 *   page main world  ──[window.postMessage]──►  content script
 *                    ──[chrome.runtime.Port]──►  service worker
 *                    ──[chrome.runtime.Port]──►  panel (this)
 *
 * Opens a long-lived port to the service worker named with the
 * inspected tab id (so the service worker can pair us with the
 * content script for the same tab).
 */
export function createRuntimeTransport(): IncomingTransport {
  return {
    subscribe(handler) {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      handler.onStatus('connecting');

      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connect({ name: `panel:${tabId}` });
      } catch {
        handler.onStatus('closed');
        return () => {};
      }

      handler.onStatus('open');

      const onMessage = (msg: unknown) => {
        // Service worker only forwards our protocol messages; trust
        // the type narrowing here.
        handler.onMessage(msg as CoreToUi);
      };
      port.onMessage.addListener(onMessage);

      const onDisconnect = () => {
        handler.onStatus('closed');
      };
      port.onDisconnect.addListener(onDisconnect);

      return () => {
        port.onMessage.removeListener(onMessage);
        port.onDisconnect.removeListener(onDisconnect);
        port.disconnect();
      };
    },
  };
}
