# Chrome Web Store listing — copy to paste into the submission form

The strings below are drafts. Edit before submitting if anything
rings wrong; the Web Store doesn't let you tweak much after the
first version is published.

---

## Item name (45 chars max)

```
Relay Inspector
```

If a reviewer flags this for trademark adjacency to Meta's "Relay,"
fall back to **"Relay Store Inspector"** (21 chars), which is
unambiguously descriptive use.

---

## Summary (132 chars max — shown under the item name in the store)

```
A read-only DevTools panel for inspecting the normalized record cache in Relay apps. Tree view, ref navigation, live updates.
```

---

## Description (long, ~500–1500 chars works well)

```
Relay Inspector is a Chrome DevTools panel for exploring the normalized
record cache in apps built on Relay (relay.dev). When you open DevTools
on a Relay-using page, the panel attaches to every Relay Environment
the app constructs and streams live snapshots of the record store as
the app runs.

Features

  • Tree view of every record in the store, grouped by GraphQL
    __typename, with sticky group headers and a fast searchable list
  • Friendly labels — records that have name / title / email / etc.
    show by their value, not just by the opaque global ID
  • Clickable __ref / __refs chips for navigating between connected
    records like links
  • VSCode-style preview tabs (single-click previews, double-click
    pins) so you can wander without filling the bar with tabs
  • Back/forward navigation history (Cmd+[ / Cmd+]) and Up/Down arrow
    keys for walking the record list
  • Live updates — every store.publish in the app re-renders the
    panel; reload-detection re-syncs the store on page refresh

What it doesn't do

  • No mutations, no time travel, no editing — strictly read-only
  • No data leaves your device; the inspector and the page communicate
    via chrome.runtime ports inside your browser only

For details, open source code, and bug reports:
https://github.com/dbharris2/relay-inspector
```

---

## Category

```
Developer Tools
```

---

## Language

```
English (United States)
```

---

## Single-purpose statement (asked during submission)

```
Inspect the normalized record store of Relay-based web applications
in Chrome DevTools.
```

---

## Permission justifications (asked during submission)

### `host_permissions: <all_urls>`

```
The extension installs a passive hook into the inspected page's
JavaScript world so it can observe Relay Environment registrations.
Without <all_urls>, users cannot inspect their own Relay-using
applications regardless of which URL they're served from. The
extension is dormant on pages without Relay: no activity occurs
until a Relay Environment registers with the hook, and no data
flows until the DevTools panel for that tab is opened.
```

### `world: 'MAIN'` content script

```
Relay's Environment constructor calls
window.__RELAY_DEVTOOLS_HOOK__.registerEnvironment(environment) to
register itself with devtools. That window object is only visible
from the page's main JavaScript world, not the isolated content-
script world. The MAIN-world content script installs the hook
function on window and otherwise does nothing.
```

### Remote code use

```
No. The extension bundles all of its JavaScript at build time. It
does not load scripts, modules, or other code from any remote
source at runtime.
```

### Data use

```
The extension reads the contents of the Relay record cache (which
may contain personally identifiable information depending on the
inspected application) and forwards those records over
chrome.runtime ports to the DevTools panel on the same device.
The extension does not transmit data to any remote server, does
not persist data between sessions, does not sell or share any
data with third parties.
```

---

## Privacy policy URL

```
https://github.com/dbharris2/relay-inspector/blob/main/PRIVACY.md
```

---

## Screenshots needed

Need 1–5 PNG/JPEG images at 1280×800 or 640×400. Capture from a
real Relay-using page with DevTools open:

1. **The whole panel** — left record list with a real type bucket
   expanded, right-pane record details with several `__ref` chips.
2. **Search active** — type a few characters; show the list
   filtered, with the result count badge updated.
3. **Multiple tabs open** — preview + pinned mix, back/forward
   arrows enabled.
4. (Optional) **Status badge connecting** — useful for showing the
   real-time aspect.
5. (Optional) **Zoomed-in detail pane** — close-up of a record with
   sanitized fields + ref chips, for the install-card preview.

---

## Promo tile (440×280, optional but recommended)

Not yet produced. The icon set can be reused for a quick tile
(`extension/icons/icon-128.png` against a wider indigo background
with the wordmark "Relay Inspector"), or you can design something
richer.
