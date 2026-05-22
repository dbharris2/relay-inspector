# @relay-inspector/ui

The React inspector. Source-only library — no build step; consumers (`@relay-inspector/server` and `@relay-inspector/extension`) bundle the source through their own Vite pipelines.

## Scripts

```sh
pnpm test       # vitest (pure helpers + reducers)
pnpm lint
pnpm format
pnpm typecheck
```

No `build` script — the package is consumed at source by the deploys' Vite configs.

## Exports

`package.json` lists each entrypoint explicitly with its file extension. Subpath wildcards (`"./*": "./src/*"`) work in Vite but don't resolve cleanly under TypeScript with `moduleResolution: bundler`, so we enumerate. **When you add a new exported file under `src/`, add it to the `exports` map** — otherwise consumers will get "Cannot find module '@relay-inspector/ui/Foo'" at typecheck time.

## Dependencies

`react` and `react-dom` are declared as `peerDependencies` so they resolve to a single instance in the consuming app — duplicate React copies would mean separate hook dispatchers, broken context, and the usual headaches.

`@relay-inspector/core` is a regular `dependency` (via `workspace:*`); the UI imports protocol types from it but never instantiates the hook side.
