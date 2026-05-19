import type { CoreToUi } from '~/shared/protocol';

/**
 * Connection state surfaced in the UI's status badge.
 */
export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export type TransportHandler = {
  onMessage(msg: CoreToUi): void;
  onStatus(status: ConnectionStatus): void;
};

/**
 * Abstraction over "stream of inspector messages from somewhere."
 *
 * The standalone deploy uses a WebSocket back to the local server.
 * The Chrome-extension deploy uses chrome.runtime ports between the
 * content script and the devtools panel. The React UI in `useInspector`
 * only cares about the messages, so it takes a Transport.
 *
 * Subscribe returns an unsubscribe function (effect cleanup contract).
 */
export type IncomingTransport = {
  subscribe(handler: TransportHandler): () => void;
};

/**
 * WebSocket-backed transport used by the standalone deploy. Reconnects
 * with a 2-second backoff so leaving the inspector tab open across
 * server restarts Just Works.
 */
export function createWebSocketTransport(url: string): IncomingTransport {
  return {
    subscribe(handler) {
      let cancelled = false;
      let ws: WebSocket | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;

      const connect = () => {
        if (cancelled) return;
        handler.onStatus('connecting');
        ws = new WebSocket(url);

        ws.addEventListener('open', () => handler.onStatus('open'));

        ws.addEventListener('message', (evt) => {
          let msg: CoreToUi;
          try {
            msg = JSON.parse(String(evt.data)) as CoreToUi;
          } catch {
            return;
          }
          handler.onMessage(msg);
        });

        const handleClose = () => {
          handler.onStatus('closed');
          ws = null;
          if (cancelled) return;
          retryTimer = setTimeout(connect, 2000);
        };
        ws.addEventListener('close', handleClose);
        ws.addEventListener('error', handleClose);
      };

      connect();

      return () => {
        cancelled = true;
        if (retryTimer != null) clearTimeout(retryTimer);
        ws?.close();
      };
    },
  };
}
