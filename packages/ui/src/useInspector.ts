import { useEffect, useRef, useState } from 'react';
import type {
  CoreToUi,
  EnvironmentId,
  EnvironmentSnapshot,
} from '@relay-inspector/core/protocol';
import type { ConnectionStatus, IncomingTransport } from './transport';

export type { ConnectionStatus };

export type InspectorState = {
  status: ConnectionStatus;
  environments: ReadonlyMap<EnvironmentId, EnvironmentSnapshot>;
};

/**
 * Subscribes to a transport and folds incoming messages into a
 * per-environment snapshot map. Reconnect / backoff / wire format are
 * the transport's concern; this hook is purely a state reducer.
 */
export function useInspector(transport: IncomingTransport): InspectorState {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [environments, setEnvironments] = useState<
    ReadonlyMap<EnvironmentId, EnvironmentSnapshot>
  >(new Map());

  // Mirror of the latest environments map kept in a ref so the
  // transport's getKnownVersions callback (invoked on reconnect)
  // sees current state without us having to re-subscribe on every
  // version bump. Synced in an effect rather than during render — the
  // transport invokes getKnownVersions asynchronously, so the
  // microscopic gap between render commit and effect run is harmless.
  const environmentsRef = useRef(environments);
  useEffect(() => {
    environmentsRef.current = environments;
  }, [environments]);

  useEffect(() => {
    return transport.subscribe({
      onStatus: setStatus,
      onMessage(msg: CoreToUi) {
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
      },
      getKnownVersions() {
        const out: { [envId: string]: number } = {};
        for (const [envId, snap] of environmentsRef.current) {
          if (snap.version > 0) out[envId] = snap.version;
        }
        return out;
      },
    });
  }, [transport]);

  return { status, environments };
}
