import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecordSource } from '@relay-inspector/core/protocol';
import { getRecordLabel, shortenId } from './labels';
import { buildGroups, type RecordGroup } from './recordGroups';

export type Props = {
  records: RecordSource;
  selectedId: string | null;
  /** Single click — opens or activates the record as a preview tab. */
  onPreview: (id: string) => void;
  /** Double click — opens the record as a pinned (non-preview) tab. */
  onPin: (id: string) => void;
};

export function RecordList({ records, selectedId, onPreview, onPin }: Props) {
  const [search, setSearch] = useState('');
  // The user's manual collapse state. Persists across selection
  // changes, but is overridden in render by `effectivelyCollapsed` so
  // the group containing the active selection always shows expanded.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo(() => buildGroups(records, search), [records, search]);
  const totalShown = useMemo(
    () => groups.reduce((n, g) => n + g.ids.length, 0),
    [groups],
  );

  // Derive the actual collapse set: never collapse the group containing
  // the active selection, even if the user previously collapsed it.
  // Replaces a setState-in-effect that auto-expanded on selection.
  const effectivelyCollapsed = useMemo(() => {
    if (selectedId == null) return collapsed;
    const typename = records[selectedId]?.__typename;
    if (typename == null || !collapsed.has(typename)) return collapsed;
    const next = new Set(collapsed);
    next.delete(typename);
    return next;
  }, [collapsed, selectedId, records]);

  const rowRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const registerRow = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      if (el == null) rowRefs.current.delete(id);
      else rowRefs.current.set(id, el);
    },
    [],
  );

  // Scroll the active row into view whenever the selection changes
  // (commonly from a ref-chip click). No setState in the effect: the
  // group containing the selection is guaranteed expanded via
  // effectivelyCollapsed above, so by the time this runs the row's
  // ref is already in the map.
  useEffect(() => {
    if (selectedId == null) return;
    const el = rowRefs.current.get(selectedId);
    if (el != null) el.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  // Flat, ordered list of currently-visible record ids — i.e. the
  // ids shown to the user in the left pane (groups in display order,
  // collapsed groups skipped). Up/Down arrows step through this list.
  const visibleIds = useMemo(() => {
    const out: string[] = [];
    for (const g of groups) {
      if (effectivelyCollapsed.has(g.typename)) continue;
      out.push(...g.ids);
    }
    return out;
  }, [groups, effectivelyCollapsed]);

  // Up/Down arrows navigate between visible records. Suppressed when
  // focus is in an input (the search box) so arrow keys keep their
  // text-cursor behavior there.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if (visibleIds.length === 0) return;

      e.preventDefault();
      const cur = selectedId != null ? visibleIds.indexOf(selectedId) : -1;
      const next =
        e.key === 'ArrowDown'
          ? cur < 0
            ? 0
            : Math.min(cur + 1, visibleIds.length - 1)
          : cur < 0
            ? visibleIds.length - 1
            : Math.max(cur - 1, 0);
      if (next !== cur) onPreview(visibleIds[next]!);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visibleIds, selectedId, onPreview]);

  function toggle(typename: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(typename)) next.delete(typename);
      else next.add(typename);
      return next;
    });
  }

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] border-r border-zinc-800">
      <div className="border-b border-zinc-800 p-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${Object.keys(records).length} records`}
          className="w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:bg-zinc-800"
        />
      </div>

      <div className="overflow-y-auto">
        {groups.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">
            {search ? 'No matching records.' : 'No records yet.'}
          </div>
        ) : (
          groups.map((g) => (
            <Group
              key={g.typename}
              group={g}
              records={records}
              collapsed={effectivelyCollapsed.has(g.typename)}
              onToggle={() => toggle(g.typename)}
              selectedId={selectedId}
              onPreview={onPreview}
              onPin={onPin}
              registerRow={registerRow}
            />
          ))
        )}
      </div>

      <div className="border-t border-zinc-800 px-2 py-1 text-[10px] text-zinc-500">
        {totalShown} of {Object.keys(records).length} records
      </div>
    </div>
  );
}

function Group({
  group,
  records,
  collapsed,
  onToggle,
  selectedId,
  onPreview,
  onPin,
  registerRow,
}: {
  group: RecordGroup;
  records: RecordSource;
  collapsed: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onPreview: (id: string) => void;
  onPin: (id: string) => void;
  registerRow: (id: string, el: HTMLButtonElement | null) => void;
}) {
  return (
    <div className="border-b border-zinc-900">
      <button
        onClick={onToggle}
        className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-zinc-900 bg-zinc-950 px-2 py-1.5 text-left text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block size-2 transition-transform ${
              collapsed ? '' : 'rotate-90'
            }`}
          >
            ▸
          </span>
          {group.typename}
        </span>
        <span className="text-[10px] font-normal text-zinc-500">
          {group.ids.length}
        </span>
      </button>

      {!collapsed && (
        <div>
          {group.ids.map((id) => {
            const record = records[id];
            const label = getRecordLabel(record);
            const isSelected = id === selectedId;
            return (
              <button
                key={id}
                ref={(el) => registerRow(id, el)}
                onClick={() => onPreview(id)}
                onDoubleClick={() => onPin(id)}
                // scroll-mt-8 keeps scrollIntoView({block:'nearest'})
                // from parking this row underneath the sticky group
                // header — the browser treats the row as starting 2rem
                // above its real position when calculating scroll, so
                // the row lands just below the header instead of behind
                // it.
                className={`flex w-full scroll-mt-8 select-none flex-col gap-0.5 px-3 py-1 text-left text-xs ${
                  isSelected
                    ? 'bg-sky-900/40 text-sky-100'
                    : 'text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <span className="truncate">{label ?? shortenId(id)}</span>
                {label != null && (
                  <span className="truncate text-[10px] text-zinc-500">
                    {shortenId(id, 48)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
