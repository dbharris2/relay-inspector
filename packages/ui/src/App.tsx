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
import * as Tab from './tabReducer';

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
  const [tabsByEnv, setTabsByEnv] = useState<ReadonlyMap<string, Tab.TabState>>(
    new Map(),
  );
  const tabs =
    (activeEnvId != null ? tabsByEnv.get(activeEnvId) : null) ?? Tab.EMPTY_TABS;

  const updateTabs = useCallback(
    (envId: string, fn: (s: Tab.TabState) => Tab.TabState) => {
      setTabsByEnv((prev) => {
        const cur = prev.get(envId) ?? Tab.EMPTY_TABS;
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
      updateTabs(activeEnvId, (s) => Tab.openRecord(s, id, asPreview));
    },
    [activeEnvId, updateTabs],
  );

  const activateTab = useCallback(
    (id: string) => {
      if (activeEnvId == null) return;
      updateTabs(activeEnvId, (s) => Tab.activateTab(s, id));
    },
    [activeEnvId, updateTabs],
  );

  const pinTab = useCallback(
    (id: string) => {
      if (activeEnvId == null) return;
      updateTabs(activeEnvId, (s) => Tab.pinTab(s, id));
    },
    [activeEnvId, updateTabs],
  );

  const closeTab = useCallback(
    (id: string) => {
      if (activeEnvId == null) return;
      updateTabs(activeEnvId, (s) => Tab.closeTab(s, id));
    },
    [activeEnvId, updateTabs],
  );

  const goBack = useCallback(() => {
    if (activeEnvId == null) return;
    updateTabs(activeEnvId, Tab.goBack);
  }, [activeEnvId, updateTabs]);

  const goForward = useCallback(() => {
    if (activeEnvId == null) return;
    updateTabs(activeEnvId, Tab.goForward);
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
