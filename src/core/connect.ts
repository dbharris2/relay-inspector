import type { CoreToUi } from '~/shared/protocol';

/**
 * Minimal WebSocket client used by the core script to ship messages
 * from the user's app to the inspector server.
 *
 * Features:
 *   - Lazy: socket isn't opened until the first send.
 *   - Buffered: messages sent before the socket is OPEN are queued.
 *   - Self-healing: on close/error, retries every 2s indefinitely.
 *
 * If the inspector server isn't running, sending is a no-op — the queue
 * just doesn't drain. Devs can leave the snippet in their app
 * permanently and start the inspector whenever they want.
 */

export type ConnectOptions = {
  host?: string;
  port?: number;
};

const RETRY_MS = 2000;

export type Connection = {
  send(message: CoreToUi): void;
};

export function createConnection(options: ConnectOptions = {}): Connection {
  const host = options.host ?? 'localhost';
  const port = options.port ?? 8097;
  const url = `ws://${host}:${port}/ws`;

  let ws: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const queue: CoreToUi[] = [];

  function open() {
    if (ws) return;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleRetry();
      return;
    }
    ws.addEventListener('open', flush);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('error', handleClose);
  }

  function handleClose() {
    if (ws) {
      ws.removeEventListener('open', flush);
      ws.removeEventListener('close', handleClose);
      ws.removeEventListener('error', handleClose);
      ws = null;
    }
    scheduleRetry();
  }

  function scheduleRetry() {
    if (retryTimer != null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      open();
    }, RETRY_MS);
  }

  function flush() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (queue.length > 0) {
      const msg = queue.shift()!;
      ws.send(JSON.stringify(msg));
    }
  }

  return {
    send(message) {
      queue.push(message);
      if (!ws) {
        open();
      } else if (ws.readyState === WebSocket.OPEN) {
        flush();
      }
    },
  };
}
