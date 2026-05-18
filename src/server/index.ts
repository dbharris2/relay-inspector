/**
 * Local dev server for the inspector.
 *
 *   - HTTP serves the built UI, the core.js bundle, and a demo page.
 *   - WebSocket at /ws relays messages from "core" clients (i.e. the
 *     user's app) to "ui" clients (the inspector tab).
 *
 * One server, two roles, simple broadcast. Good enough for personal
 * single-developer use.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 8097);

const HERE = fileURLToPath(new URL('.', import.meta.url));
// In dev (tsx watch) HERE is .../src/server, so project root is two up.
// In a built bin (dist/) the layout will mirror this.
const ROOT = resolve(HERE, '..', '..');

const UI_DIR = join(ROOT, 'dist', 'ui');
const CORE_FILE = join(ROOT, 'dist', 'core', 'core.js');
const DEMO_DIR = join(ROOT, 'fixtures', 'demo');
const RELAY_DEMO_DIR = join(ROOT, 'fixtures', 'relay-demo');

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

async function serveFile(
  res: import('node:http').ServerResponse,
  filePath: string,
): Promise<void> {
  try {
    const data = await readFile(filePath);
    const type =
      MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

async function serveStatic(
  res: import('node:http').ServerResponse,
  dir: string,
  urlPath: string,
  fallback: string,
): Promise<void> {
  const cleaned = normalize(urlPath).replace(/^[/\\]+/, '');
  const candidate = cleaned === '' ? fallback : cleaned;
  const filePath = join(dir, candidate);
  if (!filePath.startsWith(dir)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      await serveFile(res, join(filePath, fallback));
    } else {
      await serveFile(res, filePath);
    }
  } catch {
    // SPA fallback: serve index.html for unknown paths under UI_DIR.
    if (dir === UI_DIR) await serveFile(res, join(dir, fallback));
    else res.writeHead(404).end('Not found');
  }
}

const http = createServer((req, res) => {
  const url = req.url ?? '/';

  if (url === '/core.js') {
    void serveFile(res, CORE_FILE);
    return;
  }
  if (url === '/demo' || url.startsWith('/demo/')) {
    void serveStatic(res, DEMO_DIR, url.replace(/^\/demo/, ''), 'index.html');
    return;
  }
  if (url === '/relay-demo' || url.startsWith('/relay-demo/')) {
    void serveStatic(
      res,
      RELAY_DEMO_DIR,
      url.replace(/^\/relay-demo/, ''),
      'index.html',
    );
    return;
  }
  void serveStatic(res, UI_DIR, url, 'index.html');
});

const wss = new WebSocketServer({ server: http, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', (socket) => {
  clients.add(socket);
  console.log(`[relay-inspector] client connected (${clients.size} total)`);

  socket.on('message', (data) => {
    // Broadcast to every other client. Single-producer, single-consumer
    // is the common case (one core, one UI), but multi-UI works too.
    for (const peer of clients) {
      if (peer !== socket && peer.readyState === WebSocket.OPEN) {
        peer.send(data, { binary: false });
      }
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
    console.log(
      `[relay-inspector] client disconnected (${clients.size} total)`,
    );
  });
});

http.listen(PORT, () => {
  console.log(
    `[relay-inspector] listening on http://localhost:${PORT}\n` +
      `  UI:          http://localhost:${PORT}/\n` +
      `  Fake demo:   http://localhost:${PORT}/demo/\n` +
      `  Relay demo:  http://localhost:${PORT}/relay-demo/\n` +
      `  Core:        http://localhost:${PORT}/core.js\n` +
      `  WS:          ws://localhost:${PORT}/ws`,
  );
});
