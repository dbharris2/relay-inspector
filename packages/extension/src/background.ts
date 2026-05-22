/**
 * Service worker. Routes inspector messages between each tab's content
 * script and the devtools panel attached to that tab, and tells the
 * page's main-world hook when a panel comes and goes:
 *
 *   Upstream:   content port (one per tab, opened lazily)
 *               → panel port (one per panel:<tabId>)
 *
 *   Downstream: panel.connected / panel.goodbye synthesized here on
 *               content/panel port-pair transitions
 *               → content port
 *               → main-world via window.postMessage
 *
 * Routing downstream signals through the content port (rather than
 * chrome.tabs.sendMessage) keeps the message on the same channel the
 * main-world hook already uses upstream, so a working upstream port
 * implies a working downstream path.
 *
 * Stateful only as long as the worker stays alive; if Chrome
 * hibernates it the maps reset, but the panel transport reconnects on
 * disconnect and the content script reopens its port on the next
 * upstream event, so the chain re-establishes.
 */
import type {
  PanelConnected,
  PanelGoodbye,
} from '@relay-inspector/core/protocol';

const contentByTab = new Map<number, chrome.runtime.Port>();
const panelByTab = new Map<number, chrome.runtime.Port>();

const PANEL_CONNECTED: PanelConnected = { type: 'panel.connected' };
const PANEL_GOODBYE: PanelGoodbye = { type: 'panel.goodbye' };

function postToContent(
  tabId: number,
  msg: PanelConnected | PanelGoodbye,
): void {
  const content = contentByTab.get(tabId);
  if (content == null) return;
  try {
    content.postMessage(msg);
  } catch {
    // Port can race with disconnect; the onDisconnect handler will
    // clean up the map entry.
  }
}

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

    // If a panel is already attached for this tab, wake the hook up.
    // The common path is panel-first (devtools open before the Relay
    // app does anything); content opens its port lazily on the first
    // env.registered, and that's our cue to tell main-world the panel
    // is here so it starts sanitizing.
    if (panelByTab.has(tabId)) postToContent(tabId, PANEL_CONNECTED);
    return;
  }

  if (port.name.startsWith('panel:')) {
    const tabId = Number(port.name.slice('panel:'.length));
    if (!Number.isFinite(tabId)) return;
    panelByTab.set(tabId, port);

    port.onDisconnect.addListener(() => {
      if (panelByTab.get(tabId) === port) panelByTab.delete(tabId);
      postToContent(tabId, PANEL_GOODBYE);
    });

    // Content-first path: page was already running, opened its port
    // on the first env.registered, and the hook is currently
    // suspended. Tell main-world a panel just attached.
    if (contentByTab.has(tabId)) postToContent(tabId, PANEL_CONNECTED);
    return;
  }
});

export {};
