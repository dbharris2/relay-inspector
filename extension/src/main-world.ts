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
 */
import { installHook } from '~/core/hook';
import type { CoreToUi } from '~/shared/protocol';
import { ENVELOPE_TAG, type Envelope } from './envelope';

installHook({
  send(msg: CoreToUi) {
    const envelope: Envelope = { __relay_inspector__: ENVELOPE_TAG, msg };
    window.postMessage(envelope, '*');
  },
});
