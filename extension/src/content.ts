/**
 * Content script (isolated world). Bridges window.postMessage from the
 * page's main world (where main-world.ts installs the Relay hook) to a
 * long-lived chrome.runtime Port to the service worker. The service
 * worker routes onward to the devtools panel for this tab.
 *
 * We open the Port lazily on the first inspector message we see, and
 * retry once if the first send fails — Chrome may have hibernated the
 * service worker between events, invalidating the cached port. The
 * retry call wakes it back up.
 */
import { isEnvelope, type Envelope } from './envelope';

let port: chrome.runtime.Port | null = null;

function openPort(): chrome.runtime.Port {
  const fresh = chrome.runtime.connect({ name: 'content' });
  fresh.onDisconnect.addListener(() => {
    if (port === fresh) port = null;
  });
  return fresh;
}

function send(envelope: Envelope): void {
  if (port == null) port = openPort();
  try {
    port.postMessage(envelope.msg);
    return;
  } catch {
    port = null;
  }
  // Single retry: reopens against a freshly-revived service worker.
  try {
    port = openPort();
    port.postMessage(envelope.msg);
  } catch {
    port = null;
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  // postMessage broadcasts to every listener on this window. Filter to
  // messages from this same window (cross-frame would have a different
  // `source`) that carry our envelope tag.
  if (event.source !== window) return;
  if (!isEnvelope(event.data)) return;
  send(event.data);
});
