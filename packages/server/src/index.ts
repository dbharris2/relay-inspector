/**
 * Local dev server for the inspector.
 *
 *   - HTTP serves the built UI and the core.js bundle.
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
// HERE is packages/server/src; the UI build sits next to it in
// packages/server/dist (vite's default output).
const UI_DIR = resolve(HERE, '..', 'dist');

// core.js is the IIFE bundle produced by @relay-inspector/core; resolve
// through Node's package exports so the path keeps working whether the
// workspace is hoisted into node_modules or run from source.
const CORE_FILE = fileURLToPath(
  import.meta.resolve('@relay-inspector/core/core.js'),
);

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

async function serveUi(
  res: import('node:http').ServerResponse,
  urlPath: string,
): Promise<void> {
  const cleaned = normalize(urlPath).replace(/^[/\\]+/, '');
  const candidate = cleaned === '' ? 'index.html' : cleaned;
  const filePath = join(UI_DIR, candidate);
  if (!filePath.startsWith(UI_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      await serveFile(res, join(filePath, 'index.html'));
    } else {
      await serveFile(res, filePath);
    }
  } catch {
    // SPA fallback: any unknown path serves index.html so client-side
    // routing can take over.
    await serveFile(res, join(UI_DIR, 'index.html'));
  }
}

const http = createServer((req, res) => {
  const url = req.url ?? '/';

  if (url === '/core.js') {
    void serveFile(res, CORE_FILE);
    return;
  }
  void serveUi(res, url);
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
      `  UI:    http://localhost:${PORT}/\n` +
      `  Core:  http://localhost:${PORT}/core.js\n` +
      `  WS:    ws://localhost:${PORT}/ws`,
  );
});
