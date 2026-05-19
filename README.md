# relay-inspector

A read-only visualization tool for [Relay](https://relay.dev) stores. Renders
the normalized record cache as a navigable tree, streamed live from your running
app over WebSocket.

> Status: usable end-to-end. Tree view with VSCode-style preview tabs,
> wheel-scrollable tab bar, and live snapshot updates.

## Architecture

```
your app ─[<script src=…/core.js>]─► core ─[ws://localhost:8097]─► server ─► UI
```

- **`src/core/`** — the small JS bundle that gets loaded into the user's
  app during development. Installs a global hook (`__RELAY_DEVTOOLS_HOOK__`),
  attaches to every Relay `Environment` that registers with it, sanitizes
  the `RecordSource` on every `store.publish`, and ships snapshots over
  WebSocket. ~2 KB minified.
- **`src/server/`** — Node process serving the UI over HTTP and the
  core bundle at `/core.js`. Relays WebSocket messages between core
  clients and UI clients.
- **`src/ui/`** — the React inspector. Left pane: searchable record list
  grouped by `__typename` with sticky group headers. Right pane: tabbed
  record details with `__ref`/`__refs` chips that navigate between
  records. Tab bar supports wheel-scroll, arrow buttons, and preview vs
  pinned semantics.
- **`src/shared/`** — wire protocol types shared between `core` and `ui`.

## Development

```sh
pnpm install
pnpm dev          # UI dev server (Vite) at http://localhost:5173 — HMR
pnpm dev:server   # HTTP + WS server at http://localhost:8097
pnpm build        # build UI + core bundles into dist/
pnpm start        # build, start server, open browser
pnpm test         # vitest
pnpm typecheck
pnpm lint
pnpm format       # prettier write
pnpm relay:check  # real relay-runtime end-to-end via Node
pnpm smoke        # WS round-trip smoke test
```

While iterating on the UI run **both** `pnpm dev` and `pnpm dev:server`.
Open `http://localhost:5173` for HMR on the inspector; the WS connection
to the server on `:8097` is wired up automatically. Your dev app still
loads `core.js` from `:8097`.

## Using it against a real app

1. `pnpm build && pnpm dev:server` — serves `/core.js` and the WebSocket on `:8097`.
2. In your dev app's HTML, before any Relay-using script:
   ```html
   <script src="http://localhost:8097/core.js"></script>
   ```
3. Open `http://localhost:8097/` (or `http://localhost:5173/` in dev mode)
   for the inspector.

### Content-Security-Policy

If your dev app sets a strict CSP, allow the inspector's origins in **two**
directives:

```
script-src ... http://localhost:8097
connect-src ... ws://localhost:8097 http://localhost:8097
```

The first is for `core.js`; the second is for the WebSocket connection.
Missing either one looks like silent failure — `core.js` won't load, or it
loads but never connects. Symptoms appear in the browser console.

### Other gotchas

- **Load order matters.** The script must run before `new Environment(...)`.
  Put it as early as possible in your HTML (`<head>` is safest).
- **Another Relay devtools extension installed?** The official browser
  extension installs its own hook at `document_start`, so by the time
  `core.js` runs, the registration has already happened against the
  extension's hook. Disable the extension (or use a clean profile) when
  testing with `relay-inspector`.
- **Mixed content.** Loading `http://localhost:8097` from an `https://`
  page is blocked by browsers. Use plain `http` in dev.

## Contributing

Direct pushes to `main` are blocked by branch protection — work on a
feature branch and open a PR. CI (`.github/workflows/ci.yml`) runs
typecheck, tests, lint, format check, build, and the real-Relay
integration check on every PR and every push to `main`.

See **`AGENTS.md`** for the full contributor / agent guide.
