import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInspector, type ConnectionStatus } from './useInspector';
import { RecordList } from './RecordList';
import { RecordDetails } from './RecordDetails';
import { TabBar } from './TabBar';

const WS_URL = (() => {
  if (typeof window === 'undefined') return 'ws://localhost:8097/ws';
  // When the UI is served by the inspector server itself, use its
  // origin. In Vite dev mode (`pnpm dev`) the UI runs on :5173 and
  // points at the server's WS on :8097.
  const { hostname, port, protocol } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  if (port === '5173' || port === '')
    return `ws://${hostname || 'localhost'}:8097/ws`;
  return `${wsProto}//${hostname}:${port}/ws`;
})();

/**
 * Tab state. Mirrors VSCode's preview-tab model:
 *
 *   - `tabIds` is the ordered list of every open tab.
 *   - `previewTabId`, if non-null, identifies the single tab in the
 *     "preview" slot. A new preview replaces the existing preview
 *     rather than appending. Double-clicking a preview tab pins it
 *     (clears the slot, tab stays open).
 *   - `activeTabId` is whichever tab the right pane is currently
 *     showing.
 *
 * Invariant: previewTabId, if non-null, is in tabIds. activeTabId,
 * if non-null, is in tabIds.
 */
type TabState = {
  tabIds: readonly string[];
  previewTabId: string | null;
  activeTabId: string | null;
};

const EMPTY_TABS: TabState = {
  tabIds: [],
  previewTabId: null,
  activeTabId: null,
};

export function App() {
  const { status, environments } = useInspector(WS_URL);
  const envIds = useMemo(() => Array.from(environments.keys()), [environments]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<TabState>(EMPTY_TABS);

  // Auto-select the first env when one appears, and reset when it goes
  // away (e.g. user reloaded their app).
  useEffect(() => {
    if (activeEnvId == null && envIds.length > 0) {
      setActiveEnvId(envIds[0] ?? null);
      return;
    }
    if (activeEnvId != null && !environments.has(activeEnvId)) {
      setActiveEnvId(envIds[0] ?? null);
    }
  }, [activeEnvId, envIds, environments]);

  // Tabs are scoped to the active env. Switching envs clears them.
  useEffect(() => {
    setTabs(EMPTY_TABS);
  }, [activeEnvId]);

  const active = activeEnvId != null ? environments.get(activeEnvId) : null;

  const openRecord = useCallback((id: string, asPreview = true) => {
    setTabs((s) => {
      const isOpen = s.tabIds.includes(id);
      if (isOpen) {
        // Already open — activate it. If this is a pin request and
        // the tab is currently the preview, also clear the slot so
        // double-clicking a preview row promotes it to pinned.
        const previewTabId =
          !asPreview && s.previewTabId === id ? null : s.previewTabId;
        if (s.activeTabId === id && previewTabId === s.previewTabId) return s;
        return { ...s, activeTabId: id, previewTabId };
      }
      if (asPreview && s.previewTabId != null) {
        // Replace the existing preview slot in-place.
        return {
          tabIds: s.tabIds.map((x) => (x === s.previewTabId ? id : x)),
          previewTabId: id,
          activeTabId: id,
        };
      }
      return {
        tabIds: [...s.tabIds, id],
        previewTabId: asPreview ? id : s.previewTabId,
        activeTabId: id,
      };
    });
  }, []);

  const activateTab = useCallback((id: string) => {
    setTabs((s) => (s.activeTabId === id ? s : { ...s, activeTabId: id }));
  }, []);

  const pinTab = useCallback((id: string) => {
    setTabs((s) => (s.previewTabId === id ? { ...s, previewTabId: null } : s));
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((s) => {
      const idx = s.tabIds.indexOf(id);
      if (idx === -1) return s;
      const tabIds = s.tabIds.filter((x) => x !== id);
      const previewTabId = s.previewTabId === id ? null : s.previewTabId;
      // Prefer the tab to the right, fall back left, otherwise none.
      const activeTabId =
        s.activeTabId === id
          ? (tabIds[idx] ?? tabIds[idx - 1] ?? null)
          : s.activeTabId;
      return { tabIds, previewTabId, activeTabId };
    });
  }, []);

  return (
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)] font-sans text-sm">
      <header className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-200">
          Relay Inspector
        </h1>
        <StatusBadge status={status} />
        <div className="flex gap-1">
          {envIds.map((id) => (
            <button
              key={id}
              onClick={() => setActiveEnvId(id)}
              className={`rounded px-2 py-0.5 text-xs ${
                id === activeEnvId
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {id}
              <span className="ml-1.5 text-[10px] text-zinc-500">
                v{environments.get(id)?.version ?? 0}
              </span>
            </button>
          ))}
        </div>
      </header>

      {active == null ? (
        <EmptyState status={status} />
      ) : (
        <div className="grid h-full grid-cols-[minmax(220px,_300px)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden">
          <RecordList
            records={active.records}
            selectedId={tabs.activeTabId}
            onPreview={(id) => openRecord(id, true)}
            onPin={(id) => openRecord(id, false)}
          />
          <div className="grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <TabBar
              records={active.records}
              tabIds={tabs.tabIds}
              previewTabId={tabs.previewTabId}
              activeTabId={tabs.activeTabId}
              onSelect={activateTab}
              onPin={pinTab}
              onClose={closeTab}
            />
            <RecordDetails
              records={active.records}
              selectedId={tabs.activeTabId}
              onSelect={(id) => openRecord(id, true)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const color =
    status === 'open'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-rose-500';
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span className={`size-2 rounded-full ${color}`} />
      {status}
    </span>
  );
}

function EmptyState({ status }: { status: ConnectionStatus }) {
  return (
    <div className="grid place-items-center text-zinc-500">
      <div className="space-y-1 text-center">
        <p>
          {status === 'open'
            ? 'Connected. Waiting for a Relay environment…'
            : 'Not connected to inspector server.'}
        </p>
        <p className="text-xs text-zinc-600">
          Load{' '}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-300">
            &lt;script src="http://localhost:8097/core.js"&gt;
          </code>{' '}
          in your dev app.
        </p>
      </div>
    </div>
  );
}
