import { useMemo, useState } from 'react';
import { useInspector, type ConnectionStatus } from './useInspector';

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
  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? envIds[0] ?? null;
  const active = activeId != null ? environments.get(activeId) : null;

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] font-mono text-sm">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2.5">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-200">
          Relay Inspector
        </h1>
        <StatusBadge status={status} />
        <div className="flex gap-1">
          {envIds.map((id) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`rounded px-2 py-0.5 text-xs ${
                id === activeId
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </header>

      <main className="overflow-auto p-4">
        {active == null ? (
          <EmptyState status={status} />
        ) : (
          <pre className="whitespace-pre text-xs leading-relaxed text-zinc-300">
            {JSON.stringify(active.records, null, 2)}
          </pre>
        )}
      </main>
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
    <div className="grid h-full place-items-center text-zinc-500">
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
