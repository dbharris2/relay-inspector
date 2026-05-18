import { useEffect, useState } from 'react';
import type {
  CoreToUi,
  EnvironmentId,
  EnvironmentSnapshot,
} from '~/shared/protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export type InspectorState = {
  status: ConnectionStatus;
  environments: ReadonlyMap<EnvironmentId, EnvironmentSnapshot>;
};

/**
 * Maintains a WebSocket connection to the inspector server and folds
 * incoming messages into an environments map.
 *
 * Self-reconnects on close with a 2s backoff so leaving the inspector
 * tab open across server restarts Just Works.
 */
export function useInspector(url: string): InspectorState {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [environments, setEnvironments] = useState<
    ReadonlyMap<EnvironmentId, EnvironmentSnapshot>
  >(new Map());

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      ws = new WebSocket(url);

      ws.addEventListener('open', () => setStatus('open'));

      ws.addEventListener('message', (evt) => {
        let msg: CoreToUi;
        try {
          msg = JSON.parse(String(evt.data)) as CoreToUi;
        } catch {
          return;
        }

        setEnvironments((prev) => {
          const next = new Map(prev);
          if (msg.type === 'environment.registered') {
            if (!next.has(msg.envId)) {
              next.set(msg.envId, {
                envId: msg.envId,
                records: {},
                version: 0,
              });
            }
          } else if (msg.type === 'store.publish') {
            next.set(msg.envId, {
              envId: msg.envId,
              records: msg.records,
              version: msg.version,
            });
          }
          return next;
        });
      });

      const handleClose = () => {
        setStatus('closed');
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
  }, [url]);

  return { status, environments };
}
