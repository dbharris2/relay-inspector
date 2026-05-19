import type { CoreToUi } from '~/shared/protocol';
import type { IncomingTransport } from '~/ui/transport';

/**
 * Devtools-panel side of the message chain:
 *
 *   page main world  ──[window.postMessage]──►  content script
 *                    ──[chrome.runtime.Port]──►  service worker
 *                    ──[chrome.runtime.Port]──►  panel (this)
 *
 * Opens a long-lived port to the service worker, named with the
 * inspected tab id so the worker can pair us with the content script
 * for the same tab.
 *
 * The port disconnects whenever Chrome tears the service worker down
 * (MV3 hibernates idle workers after ~30s) — we reconnect on a 1s
 * backoff so the panel doesn't stick on 'closed' forever. The
 * reconnect itself wakes the worker; the next event from the content
 * script will reopen its own port lazily and the chain re-establishes.
 */
export function createRuntimeTransport(): IncomingTransport {
  return {
    subscribe(handler) {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      let cancelled = false;
      let port: chrome.runtime.Port | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;

      const scheduleRetry = () => {
        if (cancelled || retryTimer != null) return;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          connect();
        }, 1000);
      };

      const connect = () => {
        if (cancelled) return;
        handler.onStatus('connecting');
        try {
          port = chrome.runtime.connect({ name: `panel:${tabId}` });
        } catch {
          handler.onStatus('closed');
          scheduleRetry();
          return;
        }

        handler.onStatus('open');

        port.onMessage.addListener((msg: unknown) => {
          handler.onMessage(msg as CoreToUi);
        });

        port.onDisconnect.addListener(() => {
          port = null;
          if (cancelled) return;
          handler.onStatus('closed');
          scheduleRetry();
        });

        // Ask the page to replay any environments that registered
        // before we connected — that's the common path when DevTools
        // is opened on a page that's already loaded. Reconnects after
        // service-worker hibernation also re-handshake; sending the
        // panel's current known versions lets the core skip envs
        // whose snapshot hasn't moved.
        try {
          port.postMessage({
            type: 'panel.hello',
            knownVersions: handler.getKnownVersions?.(),
          });
        } catch {
          // Port can die immediately on reconnect storms; the
          // onDisconnect handler above schedules a retry.
        }
      };

      connect();

      return () => {
        cancelled = true;
        if (retryTimer != null) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        port?.disconnect();
      };
    },
  };
}
