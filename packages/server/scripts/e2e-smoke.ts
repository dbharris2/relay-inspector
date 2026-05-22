/**
 * Smoke test: two WebSocket clients simulate the core and the UI,
 * verify a message from one reaches the other through the server.
 */
import { WebSocket } from 'ws';

const URL = 'ws://localhost:8097/ws';

function open(): Promise<WebSocket> {
  const ws = new WebSocket(URL);
  return new Promise((res, rej) => {
    ws.once('open', () => res(ws));
    ws.once('error', rej);
  });
}

const start = Date.now();
const elapsed = () => `${Date.now() - start}ms`;

const ui = await open();
const core = await open();

const received = new Promise<unknown>((res) => {
  ui.on('message', (data) => res(JSON.parse(String(data))));
});

const payload = {
  type: 'store.publish' as const,
  envId: 'env:test',
  version: 1,
  records: { 'User:1': { __id: 'User:1', __typename: 'User', name: 'Ada' } },
};

core.send(JSON.stringify(payload));
const got = await received;

if (JSON.stringify(got) !== JSON.stringify(payload)) {
  console.error('MISMATCH');
  console.error('sent:', payload);
  console.error('got: ', got);
  process.exit(1);
}

console.log(`OK in ${elapsed()}: round-trip matches`);

ui.close();
core.close();
process.exit(0);
