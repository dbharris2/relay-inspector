# relay-inspector

A read-only visualization tool for [Relay](https://relay.dev) stores. Renders
the normalized record cache as a navigable tree, streamed live from your
running app.

Ships in two shapes:

- **Chrome extension** — install once, panel shows up in DevTools next to
  Components / Network / etc. No CSP edits, no script tag, no extra
  processes. This is the recommended path.
- **Standalone server + UI** — `pnpm dev:server` + a `<script>` tag. Used
  for developing the inspector itself with full HMR; also a viable path
  for environments where you can't or don't want to install a browser
  extension.

> Status: usable end-to-end. Tree view with VSCode-style preview tabs,
> wheel-scrollable tab bar, sticky type-group headers, live snapshot
> updates.

## Repo layout

This is a pnpm-workspace monorepo. The interesting code lives under `packages/`:

| Package | Purpose |
| --- | --- |
| [`@relay-inspector/core`](packages/core) | Relay hook + sanitizer + wire-protocol types. Builds the `core.js` IIFE the standalone deploy serves at `/core.js`. |
| [`@relay-inspector/ui`](packages/ui) | React inspector, consumed as a source-only library by both deploys. |
| [`@relay-inspector/server`](packages/server) | Node HTTP + WebSocket server, the `relay-inspector` CLI, and the standalone web entry. |
| [`@relay-inspector/extension`](packages/extension) | Chrome extension (MV3) — the primary deploy. |

Each package has its own README with package-specific instructions.

## Architecture

```
       extension deploy                       standalone deploy

  page (main world)                       page
    └─ main-world.ts (hook)                 └─ <script src=…/core.js>
       window.postMessage ↓                    WebSocket ↓
  content script (isolated)               server (Node)
       chrome.runtime.Port ↓                   WebSocket ↓
  service worker (routes by tab)          UI (browser tab)
       chrome.runtime.Port ↓
  devtools panel (UI)
```

- **`@relay-inspector/core`** (`packages/core/`) — Relay hook + sanitizer +
  protocol types. Used in **both** deploys: bundled into `core.js` (~2 KB)
  for the standalone deploy, and imported by `packages/extension/src/main-world.ts`
  for the extension deploy.
- **`@relay-inspector/ui`** (`packages/ui/`) — React inspector. Identical
  in both deploys. Takes an `IncomingTransport` (see
  `packages/ui/src/transport.ts`) so it doesn't care whether messages
  arrive over a WebSocket or a `chrome.runtime.Port`.
- **`@relay-inspector/server`** (`packages/server/`) — Node HTTP +
  WebSocket server, the `relay-inspector` CLI, and the standalone web entry.
- **`@relay-inspector/extension`** (`packages/extension/`) — manifest,
  devtools page, panel entry, content scripts (one ISOLATED, one MAIN),
  service worker, runtime transport.

## Development

```sh
pnpm install
pnpm test         # vitest
pnpm typecheck
pnpm lint
pnpm format       # prettier write
pnpm relay:check  # real relay-runtime end-to-end via Node
```

### Iterating on the inspector UI

The standalone deploy is the fastest dev loop because Vite HMR works
end-to-end:

```sh
pnpm dev:server   # HTTP + WS server at :8097
pnpm dev          # Vite UI at :5173 with HMR
```

Open `http://localhost:5173` — UI hot-reloads on save, WS still points
at the server on `:8097`. Your test app loads `core.js` from `:8097`.

### Iterating on the extension

```sh
pnpm dev:extension   # CRXJS dev server with HMR for the panel
```

Then load `dist/extension` as an unpacked extension (see below). The
content scripts and service worker still need an "Update" click in
`chrome://extensions` when they change; the panel hot-reloads on save.

### Building

```sh
pnpm build              # everything: core.js + standalone UI + extension
pnpm build:core         # core.js IIFE → packages/core/dist/core.js
pnpm build:ui           # standalone UI    → packages/server/dist/
pnpm build:extension    # Chrome extension → packages/extension/dist/
```

## Using it (Chrome extension)

For developers building from source:

1. `pnpm install && pnpm build:extension`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked**, pick `packages/extension/dist/`.

For anyone else — grab a pre-built `.zip` from the latest
[GitHub release](https://github.com/dbharris2/relay-inspector/releases),
unzip it, and load that folder as unpacked.

Then:

4. Open DevTools on any page running Relay. The **Relay Inspector**
   tab shows up in the DevTools tab strip (in the `»` overflow if too
   many panels are installed).

The panel asks the page to replay its registered environments on
connect, so opening DevTools after the page has finished loading still
populates the inspector — no manual page reload required.

### Gotchas

- **Conflicts with the official Relay DevTools extension.** Both
  install hooks at `document_start` and the last one to set
  `window.__RELAY_DEVTOOLS_HOOK__` wins. Disable the other extension
  (or use a clean profile) when testing this one. To confirm which is
  active, run `window.__RELAY_DEVTOOLS_HOOK__?.isInjected` in the
  inspected page's console — `true` means ours.
- **Updating the extension doesn't reach already-loaded tabs.**
  After clicking **Reload** on the Relay Inspector card in
  `chrome://extensions`, content scripts and service worker pick up
  the new code for _new_ tabs — but tabs that were already open at
  update time keep running the old content scripts. Symptom:
  `window.__RELAY_DEVTOOLS_HOOK__?.isInjected` returns `undefined`.
  Fix: fully reload (Cmd/Ctrl + R) any tab where you want the new
  build; if that still shows stale behavior, close and reopen the tab.
- **Service worker tear-down.** Chrome can terminate the extension's
  service worker between messages on idle pages. The panel reconnects
  on a 1 s backoff and the content script reopens its port lazily, so
  this is mostly invisible — if the panel goes quiet for a minute after
  no activity, the next event from the page (or the next reconnect's
  panel.hello) wakes the chain back up.

## Using it (standalone)

1. `pnpm build && pnpm dev:server` — serves `/core.js` and the WebSocket on `:8097`.
2. In your dev app's HTML, before any Relay-using script:
   ```html
   <script src="http://localhost:8097/core.js"></script>
   ```
3. Open `http://localhost:8097/` (or `http://localhost:5173/` while
   running `pnpm dev`) for the inspector.

### Content-Security-Policy

If your dev app sets a strict CSP, allow the inspector's origins in
**two** directives:

```
script-src ... http://localhost:8097
connect-src ... ws://localhost:8097 http://localhost:8097
```

The first is for `core.js`; the second is for the WebSocket connection.
Missing either one looks like silent failure — `core.js` won't load, or
it loads but never connects. The extension deploy doesn't need either.

### Other standalone gotchas

- **Load order matters.** The script must run before `new Environment(...)`.
  Put it as early as possible in your HTML (`<head>` is safest).
- **Mixed content.** Loading `http://localhost:8097` from an `https://`
  page is blocked by browsers. Use plain `http` in dev.
