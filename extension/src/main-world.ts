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
 * We also listen for `panel.hello` coming downstream (panel was just
 * opened on a page that already has registered envs) and replay each
 * env's registration + current snapshot so the panel doesn't sit on
 * an empty state until the next store.publish fires.
 */
import { installHook } from '~/core/hook';
import type { CoreToUi } from '~/shared/protocol';
import {
  UPSTREAM_TAG,
  isDownstreamEnvelope,
  type UpstreamEnvelope,
} from './envelope';

const { replay } = installHook({
  send(msg: CoreToUi) {
    const envelope: UpstreamEnvelope = {
      __relay_inspector_up__: UPSTREAM_TAG,
      msg,
    };
    window.postMessage(envelope, '*');
  },
});

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  if (!isDownstreamEnvelope(event.data)) return;
  const msg = event.data.msg;
  if (msg.type === 'panel.hello') {
    replay(msg.knownVersions);
  }
});
