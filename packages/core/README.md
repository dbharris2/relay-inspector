# @relay-inspector/core

The producer side of the inspector. Installs a hook into the inspected app, snapshots the Relay store on every publish, and ships sanitized snapshots over a `Connection`. Both [`@relay-inspector/server`](../server) and [`@relay-inspector/extension`](../extension) consume this package.

## Scripts

```sh
pnpm build         # IIFE bundle → dist/core.js (~2 KB, no deps)
pnpm test          # vitest (hook + sanitizer)
pnpm relay:check   # real relay-runtime through the full pipeline in Node
pnpm lint
pnpm format
pnpm typecheck
```

## Consuming the package

The IIFE bundle is what end users load — they `<script src=".../core.js">` before any code that constructs a Relay `Environment`. Inside the monorepo:

- `@relay-inspector/server` reads the built file via `import.meta.resolve('@relay-inspector/core/core.js')` and serves it at `/core.js`.
- `@relay-inspector/extension/src/main-world.ts` imports `installHook` from `@relay-inspector/core/hook` directly (CRXJS bundles it into the content script).
- Anyone needing the wire types imports `@relay-inspector/core/protocol`.

Subpath exports are declared explicitly in `package.json` (`./protocol`, `./hook`, `./connect`, `./sanitize`, `./core.js`). Add a new entry there when you expose a new module.
