# Privacy Policy

_Last updated: 2026-05-20_

This is the privacy policy for the **Relay Inspector** browser
extension and its standalone deploy.

## TL;DR

The extension does not collect, transmit, sell, or share any data.
Everything it reads from the inspected page stays on your device.

## What the extension reads

When you open Chrome DevTools on a page that uses
[Relay](https://relay.dev), the extension reads the contents of the
page's Relay store (the normalized record cache) so it can display
those records to you in the DevTools panel.

The data the extension reads includes whatever your application has
chosen to put into the Relay store. Depending on your application,
that may include personally identifiable information, user-generated
content, authentication-adjacent fields, and so on.

## Where the data goes

The data **does not leave your device**. The flow is:

```
page → content script (your browser) → service worker (your browser)
  → DevTools panel (your browser)
```

All four steps run locally in your own browser. The extension does
not contact any remote server, does not transmit data over the
network, and does not persist data to disk between sessions.

The standalone deploy (the optional Node-based server in
`src/server/`) accepts a WebSocket connection from your own browser
on `localhost:8097` and relays messages to a UI tab also running on
`localhost`. Nothing leaves the loopback interface.

## Cookies, tracking, telemetry

None. There are no analytics, no error reporters, no remote logging,
no cookies, no fingerprinting.

## Permissions justification

The extension declares broad permissions because of what it has to
do, not because of what it collects:

- **`host_permissions: <all_urls>`** — needed to install the
  inspector hook on any page where you've loaded Relay. The
  extension is dormant on pages without Relay; it does not read or
  transmit content from pages you do not actively inspect with
  DevTools.
- **`world: 'MAIN'` content script** — needed to install a hook
  inside the page's JavaScript world so Relay's `Environment`
  constructor can register itself with us. The isolated content
  script world cannot see the page's globals.

## Open source

The extension is fully open source. The source code is at
<https://github.com/dbharris2/relay-inspector> if you want to audit
exactly what runs.

## Contact

Questions, concerns, or reports of unexpected behavior:
<https://github.com/dbharris2/relay-inspector/issues>.
