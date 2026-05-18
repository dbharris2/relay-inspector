export function App() {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-200">
          Relay Inspector
        </h1>
      </header>
      <main className="grid place-items-center text-zinc-500">
        <div className="text-center">
          <p className="text-sm">Waiting for a Relay environment to connect…</p>
          <p className="mt-2 text-xs text-zinc-600">
            Add{' '}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-300">
              import 'relay-inspector/connect'
            </code>{' '}
            to your dev entry.
          </p>
        </div>
      </main>
    </div>
  );
}
