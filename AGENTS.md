# AGENTS.md

Notes for AI coding agents (and humans new to the repo). The README is
the user-facing overview; this file is the contributor guide.

## What this project is

A read-only inspector for [Relay](https://relay.dev) stores, shipping in
two delivery shells off a single shared UI:

- **Chrome extension** (`extension/`) — the primary deploy. Manifest V3,
  two content scripts (one in the page's MAIN world for the hook, one
  in the isolated world to bridge), a service worker that routes
  per-tab, and a devtools panel that renders the UI.
- **Standalone server** (`src/server/`, `bin.ts`) — Node HTTP + WebSocket
  server serving the same UI at `localhost:8097`, with a script-tag
  injection path (`/core.js`). Used to develop the inspector itself
  with full Vite HMR; also serves as the fallback when an extension
  isn't usable.

Shared across both:

- **core** (`src/core/`) — hook + sanitizer. The hook is the same code
  in both shells; only the `Connection` differs (WebSocket in standalone,
  `window.postMessage` in the extension's main-world script).
- **ui** (`src/ui/`) — React app. Takes an `IncomingTransport`
  (`src/ui/transport.ts`) so it doesn't know or care which transport
  it's plugged into.
- **shared** (`src/shared/protocol.ts`) — wire protocol types.

The architecture diagram lives in the README; here we focus on
"things you need to know to change code."

## Version control

This repo uses [Jujutsu](https://github.com/jj-vcs/jj) (`jj`). It's
colocated with git so the same `.git` directory backs both. Common
commands:

- `jj status` — current change
- `jj describe -m "..."` — set the commit message on the current change
- `jj new` — start a fresh change on top of the current
- `jj log -r main..@` — see commits ahead of main
- `jj bookmark create my-feature -r @` — create a feature bookmark
- `jj git push --bookmark my-feature --remote origin --allow-new` — push it

The user's preferences map common git commands to jj equivalents; see
`~/.claude/CLAUDE.md`.

## Branch protection

Direct pushes to `main` are blocked. To land changes:

1. Make commits with `jj describe` as usual.
2. Create a feature bookmark.
3. Push the bookmark.
4. Open a PR with `gh pr create`.
5. CI's `check` job must pass.
6. One code-owner approval required (the repo owner is the sole owner via `CODEOWNERS`).
   GitHub disallows authors approving their own PRs; the repo owner is
   an admin and can bypass the review requirement via the GitHub UI on
   the PR ("Merge without waiting for requirements"). That's the
   intended escape hatch for solo work.

## Quality gates (must pass before committing)

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build           # builds UI, core.js, AND the extension
pnpm relay:check
```

CI (`.github/workflows/ci.yml`) runs these on every PR and every push to
main. Don't merge if any are red.

## Conventions

### Code style

- TypeScript everywhere. `strict: true`. No `any` unless cornered.
- Functional React with hooks. No class components.
- Tailwind 4 for styles. Prefer the `dark:` variant pattern even though
  light mode isn't shipped (we're locking in the tokens to make adding
  light mode trivial later).
- Default to no comments. Only comment to explain _why_ something is
  non-obvious — a hidden constraint, a workaround, a surprising choice.

### React hooks (ESLint v7+)

`eslint-plugin-react-hooks@7` enforces `set-state-in-effect`. **Don't
call `setState` synchronously inside `useEffect`.** Alternatives:

- Derive in render via `useMemo` (most common fix).
- For external state (DOM, observers), use `useSyncExternalStore`. See
  `src/ui/useHorizontalScrollEdges.ts` for a working example.
- For per-instance state that should reset on a prop change, key a
  child component on the prop instead of resetting via effect. See
  `tabsByEnv` in `App.tsx` for the equivalent Map-based pattern.

### CSS Grid + Flexbox traps

Two gotchas appear in this codebase frequently enough to call out:

- **`minmax(0, 1fr)` on grid tracks** when you need overflowing children
  to scroll instead of pushing the track wider. A plain `1fr` track has
  a `min-content` floor that will let children expand it.
- **`min-w-0` on flex/grid children** that themselves contain
  `overflow-x-auto`. Flex items default to `min-width: auto`
  (= intrinsic content size), which defeats `flex-1` when children are
  `shrink-0`. Without `min-w-0` the child grows to its content width
  and `scrollWidth === clientWidth`, so overflow never triggers.

Both bugs have hit us. See `src/ui/App.tsx` and `src/ui/TabBar.tsx`.

### Sanitizer cycle detection

`src/core/sanitize.ts` walks arbitrary objects to produce a JSON-safe
snapshot. It tolerates cycles, but **the `ancestors` set tracks the
current path only**, not every node ever visited. Add on entry, delete
on exit (try/finally). Relay's normalized records share `__ref` object
literals across multiple containing records (DAG, not cycle) — flagging
those as `'[Circular]'` was a real regression.

The regression test for this lives in `src/core/sanitize.test.ts`.

### Transport abstraction

The UI consumes inspector messages via `IncomingTransport` (`src/ui/transport.ts`).
Two implementations:

- `createWebSocketTransport` (also in `src/ui/transport.ts`) — used by the
  standalone deploy.
- `createRuntimeTransport` (`extension/src/runtime-transport.ts`) — opens
  a `chrome.runtime.Port` from the devtools panel to the service worker,
  keyed by the inspected tab id.

The producer side (`installHook` in `src/core/hook.ts`) takes a
`Connection` which is also abstract; the standalone bundle uses a
WebSocket-backed Connection, the extension's main-world script uses a
`window.postMessage` Connection that the content script picks up.

When adding new features, prefer pushing them into the shared
`src/ui/` or `src/core/` layer rather than duplicating across deploys.

### Extension message chain

```
main-world.ts ─ window.postMessage ─►
  content.ts ─ chrome.runtime.Port ─►
    background.ts (routes by tabId) ─ chrome.runtime.Port ─►
      panel.tsx → runtime-transport.ts → useInspector
```

Things that can bite you:

- The two content scripts must run in the right worlds. The hook
  installer goes in `world: 'MAIN'`; the bridge stays in the default
  isolated world. Don't move them.
- The service worker can be torn down between messages. The content
  script reopens its port on demand; if you add state to the
  background, make it derivable from incoming messages (don't trust
  in-memory caches to survive).
- Messages emitted before the devtools panel connects are dropped.
  If you find yourself needing initial state on panel-open, the right
  fix is to have the panel send a "hello" the content script forwards
  to main-world, which then re-publishes the current snapshot — not
  to buffer in the background.

## Layout reference

```
.
├── .github/workflows/ci.yml       # GitHub Actions
├── bin.ts                         # standalone CLI — boots server + opens browser
├── extension/                     # Chrome extension deploy
│   ├── manifest.json
│   ├── devtools.html
│   ├── panel.html
│   ├── vite.config.ts             # CRXJS build → dist/extension/
│   └── src/
│       ├── background.ts          # service worker: routes ports by tabId
│       ├── content.ts             # isolated-world bridge
│       ├── main-world.ts          # page-world hook installer
│       ├── devtools.ts            # registers the panel
│       ├── panel.tsx              # mounts <App> with runtime transport
│       ├── runtime-transport.ts   # IncomingTransport via chrome.runtime
│       └── envelope.ts            # shared postMessage envelope tag
├── scripts/
│   ├── e2e-smoke.ts               # WS round-trip
│   └── relay-integration.ts       # real relay-runtime in Node — pnpm relay:check
├── src/
│   ├── core/                      # hook + sanitizer (shared)
│   ├── server/                    # standalone HTTP + WS server
│   ├── shared/protocol.ts         # wire types
│   └── ui/                        # React inspector (shared)
├── vite.config.ts                 # standalone UI build
├── vite.core.config.ts            # standalone core.js IIFE bundle
└── vitest.config.ts               # tests
```

## Local testing of changes

For visible UI work, use the standalone deploy — Vite HMR works end-to-end:

1. `pnpm dev:server` (terminal 1) — serves `/core.js` + WS on `:8097`.
2. `pnpm dev` (terminal 2) — Vite UI on `:5173` with HMR.
3. Open `http://localhost:5173/` for the inspector.
4. Point a real Relay app at `http://localhost:8097/core.js` via a
   `<script>` tag in dev to drive snapshot events.

For extension-specific behavior (content script wiring, message
passing, manifest perms), run `pnpm dev:extension` and load
`dist/extension/` as an unpacked extension. The panel hot-reloads on
save; content/background changes need a manual "Update" click in
`chrome://extensions`.

For core/sanitizer changes, `pnpm relay:check` is the fastest feedback
loop — runs the full pipeline in Node in ~1s.

## Things not in scope (yet)

- Light mode. Dark only. Tokens not extracted yet; do that step before
  shipping light.
- npm-installable CLI (`npx relay-inspector`). The CLI runs from source
  via `tsx`; bundling is deferred.
- Chrome Web Store publication. The extension can be loaded unpacked
  today; submitting takes its own steps (listing, screenshots, review).
- Graph view. A literal "render every record as a node" view of a real
  Relay store is a hairball at scale and we decided not to build it.
  More targeted forms (neighborhood view of one record, incoming-refs
  index, snapshot diff, connection visualizer) are still on the table.
