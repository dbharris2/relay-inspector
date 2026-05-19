/**
 * Service worker. Routes inspector messages from each tab's content
 * script to that tab's devtools panel.
 *
 *   content.ts (tab N)  →  service worker  →  panel for tab N
 *
 * The content script connects with name 'content'; the service worker
 * pulls the tab id off `port.sender.tab.id`. The devtools panel
 * connects with name `panel:<tabId>` so we can pair them up.
 *
 * If a panel isn't open when a message arrives, the message is dropped.
 * On first-open of devtools, the user can reload the inspected page to
 * replay the initial environment.registered + store.publish messages.
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

    port.onDisconnect.addListener(() => {
      if (panelByTab.get(tabId) === port) panelByTab.delete(tabId);
    });
    return;
  }
});

export {};
