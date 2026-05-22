# @relay-inspector/extension

A Chrome extension (Manifest V3) that adds a **Relay Inspector** panel to DevTools. The primary deploy — no CSP edits, no `<script>` tag, no extra processes for the user.

Consumes [`@relay-inspector/core`](../core) for the hook (imported directly into the MAIN-world content script — no IIFE round-trip needed) and [`@relay-inspector/ui`](../ui) for the panel UI.

## Scripts

```sh
pnpm dev      # CRXJS dev server with HMR for the panel
pnpm build    # production build → dist/
pnpm lint
pnpm format
pnpm typecheck
```

The panel hot-reloads on save; content scripts and the service worker need a manual **Update** click in `chrome://extensions` after a rebuild.

## Loading the unpacked extension

```sh
pnpm build
```

Then in Chrome:

1. Visit `chrome://extensions`.
2. Toggle **Developer mode**.
3. Click **Load unpacked**.
4. Pick `packages/extension/dist`.

Open DevTools on a Relay app — the **Relay Inspector** panel shows up in the tab strip (in the `»` overflow if too many panels are installed).

## Manifest version

The source `manifest.json` carries a placeholder version (`0.0.0` or the most recent manually-shipped version). CI patches the version on the build artifact to match the GitHub release tag — see [AGENTS.md → Releases](../../AGENTS.md#releases). Don't bother bumping the source manifest by hand.

## Privacy policy

[`../../PRIVACY.md`](../../PRIVACY.md) — referenced from the Chrome Web Store listing.
