import { useEffect, useMemo, useState } from 'react';
import { useInspector, type ConnectionStatus } from './useInspector';
import { RecordList } from './RecordList';
import { RecordDetails } from './RecordDetails';

const WS_URL = (() => {
  if (typeof window === 'undefined') return 'ws://localhost:8097/ws';
  // When the UI is served by the inspector server itself, use its
  // origin. In Vite dev mode (`pnpm dev`) the UI runs on :5173 and
  // points at the server's WS on :8097.
  const { hostname, port, protocol } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  if (port === '5173' || port === '')
    return `ws://${hostname || 'localhost'}:8097/ws`;
  return `${wsProto}//${hostname}:${port}/ws`;
})();

export function App() {
  const { status, environments } = useInspector(WS_URL);
  const envIds = useMemo(() => Array.from(environments.keys()), [environments]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Auto-select the first env when one appears, and reset when it goes
  // away (e.g. user reloaded their app).
  useEffect(() => {
    if (activeEnvId == null && envIds.length > 0) {
      setActiveEnvId(envIds[0] ?? null);
      return;
    }
    if (activeEnvId != null && !environments.has(activeEnvId)) {
      setActiveEnvId(envIds[0] ?? null);
    }
  }, [activeEnvId, envIds, environments]);

  const active = activeEnvId != null ? environments.get(activeEnvId) : null;

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] font-sans text-sm">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-200">
          Relay Inspector
        </h1>
        <StatusBadge status={status} />
        <div className="flex gap-1">
          {envIds.map((id) => (
            <button
              key={id}
              onClick={() => setActiveEnvId(id)}
              className={`rounded px-2 py-0.5 text-xs ${
                id === activeEnvId
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {id}
              <span className="ml-1.5 text-[10px] text-zinc-500">
                v{environments.get(id)?.version ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      {active == null ? (
        <EmptyState status={status} />
      ) : (
        <div className="grid grid-cols-[minmax(220px,_300px)_1fr] overflow-hidden">
          <RecordList
            records={active.records}
            selectedId={selectedRecordId}
            onSelect={setSelectedRecordId}
          />
          <RecordDetails
            records={active.records}
            selectedId={selectedRecordId}
            onSelect={setSelectedRecordId}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const color =
    status === 'open'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-rose-500';
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span className={`size-2 rounded-full ${color}`} />
      {status}
    </span>
  );
}

function EmptyState({ status }: { status: ConnectionStatus }) {
  return (
    <div className="grid place-items-center text-zinc-500">
      <div className="space-y-1 text-center">
        <p>
          {status === 'open'
            ? 'Connected. Waiting for a Relay environment…'
            : 'Not connected to inspector server.'}
        </p>
        <p className="text-xs text-zinc-600">
          Load{' '}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-300">
            &lt;script src="http://localhost:8097/core.js"&gt;
          </code>{' '}
          in your dev app.
        </p>
      </div>
    </div>
  );
}
