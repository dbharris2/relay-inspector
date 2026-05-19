# AGENTS.md

Notes for AI coding agents (and humans new to the repo). The README is
the user-facing overview; this file is the contributor guide.

## What this project is

A standalone read-only inspector for [Relay](https://relay.dev) stores.
Three pieces, all in one repo:

- **core** (`src/core/`) — injected into the user's dev app via a
  `<script>` tag from `http://localhost:8097/core.js`. Installs
  `window.__RELAY_DEVTOOLS_HOOK__`, attaches to Relay environments
  registered through that hook, captures `store.publish` events, and
  ships sanitized snapshots over WebSocket.
- **server** (`src/server/`) — Node HTTP + WebSocket process serving the
  built UI and the core bundle; relays WS messages between cores and UIs.
- **ui** (`src/ui/`) — React app rendered in a browser tab. Two-pane
  layout: record list + record details with navigable refs.

Wire protocol types live in `src/shared/protocol.ts` and are imported by
both `core` and `ui`.

## Version control

This repo uses [Jujutsu](https://github.com/jj-vcs/jj) (`jj`). It's
colocated with git so the same `.git` directory backs both. Common
commands:

- `jj status` — current change
- `jj describe -m "..."` — set the commit message on the current change
- `jj log -r main..@` — see commits ahead of main
- `jj bookmark set main -r @` — move main to the current change
- `jj git push --bookmark main --remote origin` — push

The user's preferences map common git commands to jj equivalents; see
`~/.claude/CLAUDE.md`.

## Branch protection

Direct pushes to `main` are blocked. To land changes:

1. Make commits with `jj describe` as usual.
2. Create a feature bookmark: `jj bookmark create my-feature -r @`.
3. Push the bookmark: `jj git push --bookmark my-feature --remote origin --allow-new`.
4. Open a PR with `gh pr create` (or `jj submit` if the workflow is
   configured).
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
pnpm build
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

## Layout reference

```
.
├── .github/workflows/ci.yml   # GitHub Actions
├── bin.ts                     # CLI entry — boots server + opens browser
├── scripts/
│   ├── e2e-smoke.ts           # WS round-trip
│   └── relay-integration.ts   # real relay-runtime in Node — pnpm relay:check
├── src/
│   ├── core/                  # injected into user's app
│   ├── server/                # local HTTP + WS server
│   ├── shared/protocol.ts     # wire types
│   └── ui/                    # React inspector
├── vite.config.ts             # UI build
├── vite.core.config.ts        # core IIFE bundle
└── vitest.config.ts           # tests
```

## Local testing of changes

For visible UI work:

1. `pnpm dev:server` (terminal 1) — serves `/core.js` + WS on `:8097`.
2. `pnpm dev` (terminal 2) — Vite UI on `:5173` with HMR.
3. Open `http://localhost:5173/` for the inspector.
4. Point a real Relay app at `http://localhost:8097/core.js` via a
   `<script>` tag in dev to drive snapshot events.

For core/sanitizer changes, `pnpm relay:check` is the fastest feedback
loop — runs the full pipeline in Node in ~1s.

## Things not in scope (yet)

- Light mode. Dark only. Tokens not extracted yet; do that step before
  shipping light.
- npm-installable CLI (`npx relay-inspector`). The CLI runs from source
  via `tsx`; bundling is deferred.
- Browser extension. We deliberately chose the script-tag + standalone
  UI route instead.
- Graph view. A literal "render every record as a node" view of a real
  Relay store is a hairball at scale and we decided not to build it.
  More targeted forms (neighborhood view of one record, incoming-refs
  index, snapshot diff, connection visualizer) are still on the table.
