/**
 * Content script (isolated world). Bridges the page's main world (where
 * main-world.ts installs the Relay hook) and the extension's service
 * worker in both directions:
 *
 *   - Upstream:   window.postMessage from main-world  →  long-lived
 *                 chrome.runtime.Port to the service worker.
 *   - Downstream: chrome.runtime.onMessage from the service worker  →
 *                 window.postMessage into the page so main-world can
 *                 react (today: replay envs on panel.hello).
 *
 * Two channels rather than one bidirectional port because the upstream
 * port is opened lazily — most tabs the extension matches aren't Relay
 * apps and we don't want to keep the service worker awake for them.
 * The downstream channel uses one-shot chrome.runtime.onMessage which
 * doesn't require an open port; the service worker dispatches via
 * chrome.tabs.sendMessage.
 *
 * The upstream port reopens on demand if the service worker hibernates
 * between events. A single retry covers the case where the cached port
 * has just been invalidated by a wakeup.
 */
import {
  DOWNSTREAM_TAG,
  isUpstreamEnvelope,
  type DownstreamEnvelope,
  type UpstreamEnvelope,
} from './envelope';
import type { UiToCore } from '~/shared/protocol';

let port: chrome.runtime.Port | null = null;

function openPort(): chrome.runtime.Port {
  const fresh = chrome.runtime.connect({ name: 'content' });
  fresh.onDisconnect.addListener(() => {
    if (port === fresh) port = null;
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

chrome.runtime.onMessage.addListener((msg, sender) => {
  // Only accept messages from our own extension's service worker.
  if (sender.id !== chrome.runtime.id) return;
  const envelope: DownstreamEnvelope = {
    __relay_inspector_down__: DOWNSTREAM_TAG,
    msg: msg as UiToCore,
  };
  window.postMessage(envelope, '*');
});
