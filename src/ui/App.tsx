import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useInspector, type ConnectionStatus } from './useInspector';
import type { IncomingTransport } from './transport';
import { RecordList } from './RecordList';
import { RecordDetails } from './RecordDetails';
import { TabBar } from './TabBar';

export type AppProps = {
  /** Where inspector messages come from. WebSocket for the standalone
   *  deploy, chrome.runtime port for the Chrome-extension deploy. */
  transport: IncomingTransport;
  /** Deploy-specific setup copy shown alongside the generic
   *  "waiting for a Relay environment" message when there's nothing
   *  to inspect yet. Standalone tells the user to add a script tag;
   *  the extension tells them to reload the page. */
  setupHint: ReactNode;
};

/**
 * Tab state. Mirrors VSCode's preview-tab model plus a per-env
 * navigation history (cmd-[ / cmd-] back/forward):
 *
 *   - `tabIds` is the ordered list of every open tab.
 *   - `previewTabId`, if non-null, identifies the single tab in the
 *     "preview" slot. A new preview replaces the existing preview
 *     rather than appending. Double-clicking a preview tab pins it
 *     (clears the slot, tab stays open).
 *   - `activeTabId` is whichever tab the right pane is showing.
 *   - `history` is the navigation trail — every record id the user has
 *     navigated to via row/ref-chip click or tab activation. `historyPos`
 *     indexes into it; back/forward step the index without touching
 *     `history` itself. Closed tabs stay in history and reopen as
 *     preview when navigated back to.
 *
 * Invariants:
 *   - previewTabId, if non-null, is in tabIds.
 *   - activeTabId, if non-null, is in tabIds.
 *   - 0 <= historyPos < history.length, or historyPos === -1 when
 *     history is empty.
 */
type TabState = {
  tabIds: readonly string[];
  previewTabId: string | null;
  activeTabId: string | null;
  history: readonly string[];
  historyPos: number;
};

const EMPTY_TABS: TabState = {
  tabIds: [],
  previewTabId: null,
  activeTabId: null,
  history: [],
  historyPos: -1,
};

/**
 * Append `id` to history at the current position, truncating any
 * forward entries past it (standard browser behavior). No-op when id
 * already equals the current entry.
 */
function pushHistory(s: TabState, id: string): TabState {
  if (s.historyPos >= 0 && s.history[s.historyPos] === id) return s;
  const trimmed = s.history.slice(0, s.historyPos + 1);
  return {
    ...s,
    history: [...trimmed, id],
    historyPos: trimmed.length,
  };
}

/**
 * Make sure `id` has a tab. If it doesn't, reopen it as preview,
 * replacing the existing preview slot if there is one. Used by back/
 * forward to re-materialize tabs the user previously closed.
 */
function ensureTabFor(s: TabState, id: string): TabState {
  if (s.tabIds.includes(id)) return s;
  if (s.previewTabId != null) {
    return {
      ...s,
      tabIds: s.tabIds.map((x) => (x === s.previewTabId ? id : x)),
      previewTabId: id,
    };
  }
  return {
    ...s,
    tabIds: [...s.tabIds, id],
    previewTabId: id,
  };
}

export function App({ transport, setupHint }: AppProps) {
  const { status, environments } = useInspector(transport);
  const envIds = useMemo(() => Array.from(environments.keys()), [environments]);

  // The user's explicit env pick, if any. The effective active env is
  // derived: user's pick when still valid, otherwise the first env.
  // This avoids a setState-in-effect to sync activeEnvId with the
  // available envs.
  const [userPickedEnvId, setUserPickedEnvId] = useState<string | null>(null);
  const activeEnvId =
    userPickedEnvId != null && environments.has(userPickedEnvId)
      ? userPickedEnvId
      : (envIds[0] ?? null);

  // Tabs are per-env: switching envs leaves each env's tab set alone,
  // so coming back to a previous env restores its tabs. Keyed by envId
  // in a single Map so we never need an effect to reset on env switch.
  const [tabsByEnv, setTabsByEnv] = useState<ReadonlyMap<string, TabState>>(
    new Map(),
  );
  const tabs =
    (activeEnvId != null ? tabsByEnv.get(activeEnvId) : null) ?? EMPTY_TABS;

  const updateTabs = useCallback(
    (envId: string, fn: (s: TabState) => TabState) => {
      setTabsByEnv((prev) => {
        const cur = prev.get(envId) ?? EMPTY_TABS;
        const next = fn(cur);
        if (next === cur) return prev;
        const out = new Map(prev);
        out.set(envId, next);
        return out;
      });
    },
    [],
  );

  const openRecord = useCallback(
    (id: string, asPreview = true) => {
      if (activeEnvId == null) return;
      updateTabs(activeEnvId, (s) => {
        const isOpen = s.tabIds.includes(id);
        let next: TabState;
        if (isOpen) {
          // Already open — activate it. If this is a pin request and
          // the tab is currently the preview, also clear the slot so
          // double-clicking a preview row promotes it to pinned.
          const previewTabId =
            !asPreview && s.previewTabId === id ? null : s.previewTabId;
          next = { ...s, activeTabId: id, previewTabId };
        } else if (asPreview && s.previewTabId != null) {
          // Replace the existing preview slot in-place.
          next = {
            ...s,
            tabIds: s.tabIds.map((x) => (x === s.previewTabId ? id : x)),
            previewTabId: id,
            activeTabId: id,
          };
        } else {
          next = {
            ...s,
            tabIds: [...s.tabIds, id],
            previewTabId: asPreview ? id : s.previewTabId,
            activeTabId: id,
          };
        }
        return pushHistory(next, id);
      });
    },
    [activeEnvId, updateTabs],
  );

  const activateTab = useCallback(
    (id: string) => {
      if (activeEnvId == null) return;
      updateTabs(activeEnvId, (s) => {
        if (s.activeTabId === id) return s;
        return pushHistory({ ...s, activeTabId: id }, id);
      });
    },
    [activeEnvId, updateTabs],
  );

  const pinTab = useCallback(
    (id: string) => {
      if (activeEnvId == null) return;
      updateTabs(activeEnvId, (s) =>
        s.previewTabId === id ? { ...s, previewTabId: null } : s,
      );
    },
    [activeEnvId, updateTabs],
  );

  const closeTab = useCallback(
    (id: string) => {
      if (activeEnvId == null) return;
      updateTabs(activeEnvId, (s) => {
        const idx = s.tabIds.indexOf(id);
        if (idx === -1) return s;
        const tabIds = s.tabIds.filter((x) => x !== id);
        const previewTabId = s.previewTabId === id ? null : s.previewTabId;
        // Prefer the tab to the right, fall back left, otherwise none.
        // Closing doesn't push to history — it's destructive, not a
        // navigation. History entries for the closed id stay so back
        // can reopen it as preview.
        const activeTabId =
          s.activeTabId === id
            ? (tabIds[idx] ?? tabIds[idx - 1] ?? null)
            : s.activeTabId;
        return { ...s, tabIds, previewTabId, activeTabId };
      });
    },
    [activeEnvId, updateTabs],
  );

  const goBack = useCallback(() => {
    if (activeEnvId == null) return;
    updateTabs(activeEnvId, (s) => {
      if (s.historyPos <= 0) return s;
      const pos = s.historyPos - 1;
      const target = s.history[pos]!;
      return {
        ...ensureTabFor(s, target),
        activeTabId: target,
        historyPos: pos,
      };
    });
  }, [activeEnvId, updateTabs]);

  const goForward = useCallback(() => {
    if (activeEnvId == null) return;
    updateTabs(activeEnvId, (s) => {
      if (s.historyPos >= s.history.length - 1) return s;
      const pos = s.historyPos + 1;
      const target = s.history[pos]!;
      return {
        ...ensureTabFor(s, target),
        activeTabId: target,
        historyPos: pos,
      };
    });
  }, [activeEnvId, updateTabs]);

  const canGoBack = tabs.historyPos > 0;
  const canGoForward =
    tabs.historyPos >= 0 && tabs.historyPos < tabs.history.length - 1;

  // Cmd/Ctrl + [ → back, Cmd/Ctrl + ] → forward. Matches the macOS
  // convention used by Safari/Finder/VSCode.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      if (e.key === '[') {
        e.preventDefault();
        goBack();
      } else if (e.key === ']') {
        e.preventDefault();
        goForward();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goBack, goForward]);

  const active = activeEnvId != null ? environments.get(activeEnvId) : null;

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
              onClick={() => setUserPickedEnvId(id)}
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
        <EmptyState status={status} setupHint={setupHint} />
      ) : (
        <div className="grid h-full grid-cols-[minmax(220px,_300px)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden">
          <RecordList
            records={active.records}
            selectedId={tabs.activeTabId}
            onPreview={(id) => openRecord(id, true)}
            onPin={(id) => openRecord(id, false)}
          />
          <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <TabBar
              records={active.records}
              tabIds={tabs.tabIds}
              previewTabId={tabs.previewTabId}
              activeTabId={tabs.activeTabId}
              onSelect={activateTab}
              onPin={pinTab}
              onClose={closeTab}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onGoBack={goBack}
              onGoForward={goForward}
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

function EmptyState({
  status,
  setupHint,
}: {
  status: ConnectionStatus;
  setupHint: ReactNode;
}) {
  return (
    <div className="grid place-items-center text-zinc-500">
      <div className="space-y-1 text-center">
        <p>
          {status === 'open'
            ? 'Connected. Waiting for a Relay environment…'
            : 'Not connected.'}
        </p>
        <p className="text-xs text-zinc-600">{setupHint}</p>
      </div>
    </div>
  );
}
