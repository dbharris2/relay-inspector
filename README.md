# relay-inspector

A read-only visualization tool for [Relay](https://relay.dev) stores. Renders
the normalized record cache as both a navigable tree and an interactive graph,
streamed live from your running app over WebSocket.

> Status: scaffolding. Nothing works yet.

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
```
