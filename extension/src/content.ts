/**
 * Content script (isolated world). Bridges window.postMessage from the
 * page's main world (where main-world.ts installs the Relay hook) to a
 * long-lived chrome.runtime Port to the service worker. The service
 * worker routes onward to the devtools panel for this tab.
 *
 * We open the Port lazily, on the first inspector message we see —
 * pages without Relay never wake the service worker, and Chrome can
 * GC us cleanly.
 */
import { isEnvelope } from './envelope';

let port: chrome.runtime.Port | null = null;

function ensurePort(): chrome.runtime.Port {
  if (port != null) return port;
  port = chrome.runtime.connect({ name: 'content' });
  port.onDisconnect.addListener(() => {
    port = null;
  });
  return port;
}

window.addEventListener('message', (event: MessageEvent) => {
  // postMessage broadcasts to every listener on this window. Filter
  // to messages from this same window (cross-frame would have a
  // different `source`) that carry our envelope tag.
  if (event.source !== window) return;
  if (!isEnvelope(event.data)) return;
  try {
    ensurePort().postMessage(event.data.msg);
  } catch {
    // Service worker can be torn down between messages; the next
    // attempt will re-open the port.
    port = null;
  }
});
