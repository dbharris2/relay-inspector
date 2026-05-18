/**
 * Real-Relay integration test.
 *
 * Imports relay-runtime, installs our hook, creates an Environment,
 * publishes records, and verifies that:
 *
 *   1. relay-runtime auto-registers the env with our hook.
 *   2. store.publish events flow through to our sanitizer.
 *   3. The sanitized snapshot contains the records we published.
 *
 * Runs entirely in Node — no browser needed.
 */
import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { installHook } from '../src/core/hook.ts';
import type { CoreToUi } from '../src/shared/protocol.ts';

const messages: CoreToUi[] = [];
installHook({
  send(message) {
    messages.push(message);
  },
});

const network = Network.create(() =>
  Promise.reject(new Error('integration: no network')),
);

const env = new Environment({ network, store: new Store(new RecordSource()) });

const registered = messages.find((m) => m.type === 'environment.registered');
if (!registered) {
  console.error('FAIL: env was not registered by relay-runtime');
  console.error('messages:', messages);
  process.exit(1);
}

env.getStore().publish(
  new RecordSource({
    'User:1': {
      __id: 'User:1',
      __typename: 'User',
      id: '1',
      name: 'Ada Lovelace',
    },
  }),
);

const publishes = messages.filter((m) => m.type === 'store.publish');
if (publishes.length < 2) {
  console.error(
    `FAIL: expected at least 2 store.publish messages (initial + post-publish), got ${publishes.length}`,
  );
  console.error('messages:', messages);
  process.exit(1);
}

const latest = publishes[publishes.length - 1]!;
const user = latest.records['User:1'];
if (user?.name !== 'Ada Lovelace') {
  console.error('FAIL: published record did not survive sanitization');
  console.error('latest:', latest);
  process.exit(1);
}

console.log(
  `OK: ${messages.length} messages, ` +
    `env id ${registered.envId}, ` +
    `${publishes.length} store.publish events, ` +
    `${Object.keys(latest.records).length} records in latest snapshot`,
);
