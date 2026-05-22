/**
 * Runs in the page's main JS world (Chrome MV3 content_script with
 * `world: 'MAIN'`). This is where __RELAY_DEVTOOLS_HOOK__ has to live —
 * the isolated content-script world can see the DOM but not the page's
 * own globals, and that's where Relay's Environment constructor looks
 * for us.
 *
 * The hook itself is the same one the standalone deploy uses (src/core).
 * The transport is different: instead of opening a WebSocket back to a
 * Node server, we post messages to window, where the content script
 * (isolated world, same page) picks them up and forwards them to the
 * service worker and onward to the devtools panel.
 *
 * Because content scripts inject into every page, we start the hook
 * suspended and let the background service worker tell us via
 * panel.connected / panel.goodbye when a devtools panel is actually
 * watching. That gates the expensive RecordSource sanitize off
 * unless someone's listening.
 */
import { installHook } from '@relay-inspector/core/hook';
import type { CoreToUi } from '@relay-inspector/core/protocol';
import {
  UPSTREAM_TAG,
  isDownstreamEnvelope,
  type UpstreamEnvelope,
} from './envelope';

const handle = installHook({
  send(msg: CoreToUi) {
    const envelope: UpstreamEnvelope = {
      __relay_inspector_up__: UPSTREAM_TAG,
      msg,
    };
    window.postMessage(envelope, '*');
  },
});
handle.setPanelConnected(false);

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  if (!isDownstreamEnvelope(event.data)) return;
  const msg = event.data.msg;
  if (msg.type === 'panel.connected') {
    handle.setPanelConnected(true);
    handle.replay();
  } else if (msg.type === 'panel.goodbye') {
    handle.setPanelConnected(false);
  }
});
