# @relay-inspector/server

The standalone deploy: a Node HTTP + WebSocket server that hands out the `core.js` IIFE, the React UI bundle, and a broadcast WebSocket on `:8097`. Also the home of the `relay-inspector` CLI.

Consumes [`@relay-inspector/core`](../core) for the IIFE bundle it serves and [`@relay-inspector/ui`](../ui) for the React inspector.

## Scripts

```sh
pnpm dev          # Vite UI dev server on :5173 (HMR)
pnpm dev:server   # tsx watch on src/index.ts → HTTP + WS on :8097
pnpm start        # build core + UI, then boot the CLI (opens a browser tab)
pnpm build        # build the UI bundle → dist/
pnpm smoke        # WebSocket round-trip smoke test (needs a running server)
pnpm lint
pnpm format
pnpm typecheck
```

## Dev loop

```sh
pnpm dev:server   # terminal 1 — serves /core.js + WS
pnpm dev          # terminal 2 — Vite UI on :5173 with HMR
```

Open `http://localhost:5173/` for the inspector; point a real Relay app at `http://localhost:8097/core.js` via a `<script>` tag to drive snapshot events.

## CLI

`bin.ts` is wired up as the package's `bin` entry (`relay-inspector`). For now it runs from source via `tsx`; an npm-installable bundle (`npx relay-inspector`) is deferred — see _Things not in scope_ in [AGENTS.md](../../AGENTS.md).
