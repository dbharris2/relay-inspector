/**
 * Service worker. Routes inspector messages between each tab's content
 * script and the devtools panel attached to that tab.
 *
 *   Upstream:   content port (one per tab, opened lazily)
 *               → panel port (one per panel:<tabId>)
 *
 *   Downstream: panel port message
 *               → chrome.tabs.sendMessage(tabId, ...)
 *               → content script's chrome.runtime.onMessage
 *
 * The downstream path doesn't go through the content port — that port
 * may not be open if the page hasn't done anything Relay-ish yet, and
 * we still want the panel.hello → replay handshake to land. tabs
 * messaging works without an active long-lived port.
 *
 * Stateful only as long as the worker stays alive; if Chrome
 * hibernates it the maps reset, but the panel transport reconnects on
 * disconnect and the content script reopens its port on the next
 * upstream event, so the chain re-establishes.
 */
const contentByTab = new Map<number, chrome.runtime.Port>();
const panelByTab = new Map<number, chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'content') {
    const tabId = port.sender?.tab?.id;
    if (tabId == null) return;
    contentByTab.set(tabId, port);

    port.onMessage.addListener((msg) => {
      panelByTab.get(tabId)?.postMessage(msg);
    });
    port.onDisconnect.addListener(() => {
      if (contentByTab.get(tabId) === port) contentByTab.delete(tabId);
    });
    return;
  }

  if (port.name.startsWith('panel:')) {
    const tabId = Number(port.name.slice('panel:'.length));
    if (!Number.isFinite(tabId)) return;
    panelByTab.set(tabId, port);

    port.onMessage.addListener((msg) => {
      // chrome.tabs.sendMessage returns a Promise; failure (e.g. no
      // content script in the tab yet) is fine to ignore.
      chrome.tabs.sendMessage(tabId, msg).catch(() => {});
    });
    port.onDisconnect.addListener(() => {
      if (panelByTab.get(tabId) === port) panelByTab.delete(tabId);
    });
    return;
  }
});

export {};
