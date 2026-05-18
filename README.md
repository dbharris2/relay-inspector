# relay-inspector

A read-only visualization tool for [Relay](https://relay.dev) stores. Renders
the normalized record cache as both a navigable tree and an interactive graph,
streamed live from your running app over WebSocket.

> Status: early. Wire works end-to-end; tree and graph views are stubs.

## Architecture

```
your app ─[script tag / import]─► core ─[ws://localhost:8097]─► server ─► UI
```

- **`src/core/`** — the small JS bundle that gets loaded into the user's
  app during development. Installs a global hook, watches Relay
  environments, and streams sanitized record snapshots over WebSocket.
- **`src/server/`** — Node process serving the UI over HTTP and relaying
  WebSocket messages from `core` to UI clients.
- **`src/ui/`** — the React app that renders the inspector. Tree view and
  graph view (powered by `@xyflow/react`).
- **`src/shared/`** — wire protocol types shared between `core` and `ui`.

## Development

```sh
pnpm install
pnpm dev          # start the UI (Vite) at http://localhost:5173
pnpm dev:server   # start the WS server at ws://localhost:8097
pnpm build        # build UI + core bundle into dist/
pnpm start        # build, start server, open browser
```

Useful smoke tests:

```sh
pnpm smoke        # WS round-trip through the server
pnpm relay:check  # full pipeline against real relay-runtime (Node)
```

## Using it against a real app

1. `pnpm build && pnpm dev:server` — serves `/core.js` and the WebSocket on `:8097`.
2. In your dev app's HTML, before any Relay-using script:
   ```html
   <script src="http://localhost:8097/core.js"></script>
   ```
3. Open `http://localhost:8097/` for the inspector.

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
