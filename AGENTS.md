# AGENTS.md

Notes for AI coding agents (and humans new to the repo). The README is
the user-facing overview; this file is the contributor guide.

## What this project is

A read-only inspector for [Relay](https://relay.dev) stores, organized
as a pnpm-workspace monorepo with four packages under `packages/`:

- **`@relay-inspector/extension`** (`packages/extension/`) — the primary
  deploy. Chrome Manifest V3, two content scripts (one in the page's
  MAIN world for the hook, one in the isolated world to bridge), a
  service worker that routes per-tab, and a devtools panel that
  renders the UI.
- **`@relay-inspector/server`** (`packages/server/`) — Node HTTP +
  WebSocket server (`src/index.ts`), the `relay-inspector` CLI
  (`bin.ts`), and the standalone web entry (`index.html` + `main.tsx`).
  Serves the UI at `localhost:8097` with a script-tag injection path
  (`/core.js`). Used to develop the inspector itself with full Vite
  HMR; also the fallback when an extension isn't usable.
- **`@relay-inspector/ui`** (`packages/ui/`) — React app, consumed as a
  library by both deploys. Takes an `IncomingTransport`
  (`src/transport.ts`) so it doesn't know or care which transport it's
  plugged into. Source-only; not built.
- **`@relay-inspector/core`** (`packages/core/`) — hook + sanitizer +
  wire-protocol types (`src/protocol.ts`). The hook is the same code
  in both shells; only the `Connection` differs (WebSocket in the
  standalone, `window.postMessage` in the extension's main-world
  script). Builds the IIFE bundle (`dist/core.js`) the server hands
  out at `/core.js`.

The architecture diagram lives in the README; here we focus on
"things you need to know to change code."

### Cross-package imports

Inside a package, use relative paths (`./protocol`, `./transport`).
Across packages, import via the workspace package name:

```ts
import type { CoreToUi } from '@relay-inspector/core/protocol';
import { App } from '@relay-inspector/ui/App';
```

`@relay-inspector/ui`'s `exports` field lists each entrypoint
explicitly (subpath wildcards work in Vite but don't resolve cleanly
under TS with `moduleResolution: bundler`). When you add a new
exported file in `ui`, add it to the `exports` map in
`packages/ui/package.json` too.

`@relay-inspector/core/core.js` resolves to the IIFE built by `pnpm
build:core`. The server reads it via `import.meta.resolve` so the path
keeps working whether pnpm hoists the workspace into `node_modules` or
leaves it as a symlink.

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

## Releases

Every push to `main` runs `.github/workflows/release.yml`, which:

1. Walks commits since the latest `v*` tag and picks a semver bump from
   their conventional-commit prefixes (`feat:` → minor, anything else
   → patch, `!`-suffix or `BREAKING CHANGE` → major). No new commits
   since the last tag → workflow exits early, no release.
2. Creates a GitHub release tagged `vX.Y.Z` with auto-generated notes.
3. Builds the extension, **patches the version in
   `packages/extension/dist/manifest.json` to match the release tag**,
   zips `packages/extension/dist/` (manifest at zip root, not nested),
   and uploads it as a release asset named
   `relay-inspector-vX.Y.Z.zip`.

The source `packages/extension/manifest.json` version is intentionally
a placeholder (`0.0.0` or the most recent manually-shipped version);
CI overrides it on the build artifact. Don't bother bumping the source
manifest by hand — only the release tag and the asset's manifest are
load-bearing.

To ship a Chrome Web Store update: download the zip from the latest
release page and upload it to the
[Web Store dev console](https://chrome.google.com/webstore/devconsole).

## Quality gates (must pass before committing)

```sh
pnpm typecheck       # tsc --noEmit in every package
pnpm test            # vitest in core + ui
pnpm lint            # eslint . in every package
pnpm format:check    # prettier --check in every package
pnpm build           # core IIFE, then server UI, then extension
pnpm relay:check     # real relay-runtime through the core pipeline
```

Each script at the root dispatches via pnpm filters; each package owns
its own `eslint.config.js`, `.prettierrc.json`, and `tsconfig.json`.
The root `package.json` carries no dependencies — only scripts.

CI (`.github/workflows/ci.yml`) runs these on every PR and every push
to main. Don't merge if any are red.

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
  `packages/ui/src/useHorizontalScrollEdges.ts` for a working example.
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

Both bugs have hit us. See `packages/ui/src/App.tsx` and
`packages/ui/src/TabBar.tsx`.

### Sanitizer cycle detection

`packages/core/src/sanitize.ts` walks arbitrary objects to produce a
JSON-safe snapshot. It tolerates cycles, but **the `ancestors` set
tracks the current path only**, not every node ever visited. Add on
entry, delete on exit (try/finally). Relay's normalized records share
`__ref` object literals across multiple containing records (DAG, not
cycle) — flagging those as `'[Circular]'` was a real regression.

The regression test for this lives in
`packages/core/src/sanitize.test.ts`.

### Transport abstraction

The UI consumes inspector messages via `IncomingTransport`
(`packages/ui/src/transport.ts`). Two implementations:

- `createWebSocketTransport` (also in `packages/ui/src/transport.ts`)
  — used by the standalone deploy.
- `createRuntimeTransport` (`packages/extension/src/runtime-transport.ts`)
  — opens a `chrome.runtime.Port` from the devtools panel to the
  service worker, keyed by the inspected tab id.

The producer side (`installHook` in `packages/core/src/hook.ts`) takes
a `Connection` which is also abstract; the standalone bundle uses a
WebSocket-backed Connection, the extension's main-world script uses a
`window.postMessage` Connection that the content script picks up.

When adding new features, prefer pushing them into the shared
`@relay-inspector/ui` or `@relay-inspector/core` package rather than
duplicating across deploys.

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
├── .github/workflows/             # ci.yml + release.yml
├── package.json                   # scripts only — no deps
├── pnpm-workspace.yaml            # packages: ["packages/*"]
└── packages/
    ├── core/                      # @relay-inspector/core
    │   ├── package.json           # IIFE build, vitest, relay:check
    │   ├── vite.config.ts         # core.js IIFE → dist/core.js
    │   ├── vitest.config.ts
    │   ├── scripts/
    │   │   └── relay-integration.ts  # pnpm relay:check
    │   └── src/
    │       ├── connect.ts         # WS-backed Connection for standalone
    │       ├── hook.ts            # installHook (shared)
    │       ├── iife.ts            # entry — installs hook on load
    │       ├── index.ts           # programmatic API
    │       ├── protocol.ts        # wire types (CoreToUi, UiToCore, …)
    │       └── sanitize.ts        # cycle-tolerant JSON snapshot
    ├── ui/                        # @relay-inspector/ui (source-only library)
    │   ├── package.json           # exports: { ./App, ./transport, … }
    │   ├── vitest.config.ts
    │   └── src/                   # App, RecordList, transport, hooks, …
    ├── server/                    # @relay-inspector/server
    │   ├── package.json
    │   ├── bin.ts                 # CLI — boots server + opens browser
    │   ├── index.html             # standalone web entry
    │   ├── main.tsx               # mounts <App> with WS transport
    │   ├── vite.config.ts         # UI build → dist/
    │   ├── scripts/
    │   │   └── e2e-smoke.ts       # WS round-trip
    │   └── src/
    │       └── index.ts           # HTTP + WS server
    └── extension/                 # @relay-inspector/extension
        ├── package.json
        ├── manifest.json
        ├── devtools.html
        ├── panel.html
        ├── vite.config.ts         # CRXJS build → dist/
        └── src/
            ├── background.ts      # service worker: routes ports by tabId
            ├── content.ts         # isolated-world bridge
            ├── main-world.ts      # page-world hook installer
            ├── devtools.ts        # registers the panel
            ├── panel.tsx          # mounts <App> with runtime transport
            ├── runtime-transport.ts  # IncomingTransport via chrome.runtime
            └── envelope.ts        # shared postMessage envelope tag
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
`packages/extension/dist/` as an unpacked extension. The panel
hot-reloads on save; content/background changes need a manual "Update"
click in `chrome://extensions`.

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
