/**
 * Local dev server for the inspector. Two responsibilities:
 *
 *   1. Serve the built UI (and the bundled core script) over HTTP.
 *   2. Accept a WebSocket connection from the core script running in
 *      the user's app, and broadcast incoming snapshots to any
 *      connected UI clients.
 *
 * Stub for now — runnable via `pnpm dev:server` once filled in.
 */

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8097);

const http = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('relay-inspector server — stub\n');
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (socket) => {
  console.log('[relay-inspector] client connected');
  socket.on('close', () =>
    console.log('[relay-inspector] client disconnected'),
  );
});

http.listen(PORT, () => {
  console.log(
    `[relay-inspector] http+ws listening on http://localhost:${PORT}`,
  );
});
