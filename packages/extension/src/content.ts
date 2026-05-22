/**
 * Content script (isolated world). Bridges the page's main world (where
 * main-world.ts installs the Relay hook) and the extension's service
 * worker over a single long-lived chrome.runtime.Port:
 *
 *   - Upstream:   window.postMessage from main-world  →  port.postMessage
 *                 to the service worker.
 *   - Downstream: port.onMessage from the service worker  →
 *                 window.postMessage into the page so main-world can
 *                 react to panel.connected / panel.goodbye.
 *
 * The port is opened lazily — most tabs the extension matches aren't
 * Relay apps and we don't want to keep the service worker awake for
 * them. If the worker hibernates between events the port disconnects;
 * we reopen on the next upstream send. We also tell main-world about
 * the disconnect so it suspends its hook until the next panel.connected
 * arrives through the fresh port.
 */
import {
  DOWNSTREAM_TAG,
  isUpstreamEnvelope,
  type DownstreamEnvelope,
  type UpstreamEnvelope,
} from './envelope';
import type { UiToCore } from '@relay-inspector/core/protocol';

let port: chrome.runtime.Port | null = null;

function emitDownstream(msg: UiToCore): void {
  const envelope: DownstreamEnvelope = {
    __relay_inspector_down__: DOWNSTREAM_TAG,
    msg,
  };
  window.postMessage(envelope, '*');
}

function openPort(): chrome.runtime.Port {
  const fresh = chrome.runtime.connect({ name: 'content' });
  fresh.onMessage.addListener((msg) => {
    emitDownstream(msg as UiToCore);
  });
  fresh.onDisconnect.addListener(() => {
    if (port === fresh) port = null;
    // Whatever the panel-presence state was, we no longer have a route
    // to learn about it. Suspend the hook; if a panel is still
    // watching, the background will send panel.connected once we
    // reopen the port on the next upstream send.
    emitDownstream({ type: 'panel.goodbye' });
  });
  return fresh;
}

function sendUpstream(envelope: UpstreamEnvelope): void {
  if (port == null) port = openPort();
  try {
    port.postMessage(envelope.msg);
    return;
  } catch {
    port = null;
  }
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
  // `source`) that carry our upstream envelope tag — downstream envelopes
  // we post ourselves and must ignore here.
  if (event.source !== window) return;
  if (!isUpstreamEnvelope(event.data)) return;
  sendUpstream(event.data);
});
