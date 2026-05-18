import { useMemo, useState } from 'react';
import type { RecordSource } from '~/shared/protocol';
import { getRecordLabel, shortenId } from './labels';

export type Props = {
  records: RecordSource;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type Group = {
  typename: string;
  ids: string[];
};

function buildGroups(records: RecordSource, search: string): Group[] {
  const q = search.trim().toLowerCase();
  const byType = new Map<string, string[]>();

  for (const [id, record] of Object.entries(records)) {
    if (record == null) continue;
    const typename = record.__typename ?? '(unknown)';

    if (q.length > 0) {
      const label = getRecordLabel(record);
      const haystack = `${id} ${typename} ${label ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    const list = byType.get(typename);
    if (list) list.push(id);
    else byType.set(typename, [id]);
  }

  const groups: Group[] = [];
  for (const [typename, ids] of byType) {
    ids.sort((a, b) => {
      const la = getRecordLabel(records[a]) ?? a;
      const lb = getRecordLabel(records[b]) ?? b;
      return la.localeCompare(lb);
    });
    groups.push({ typename, ids });
  }
  groups.sort((a, b) => a.typename.localeCompare(b.typename));
  return groups;
}

export function RecordList({ records, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo(() => buildGroups(records, search), [records, search]);
  const totalShown = useMemo(
    () => groups.reduce((n, g) => n + g.ids.length, 0),
    [groups],
  );

  function toggle(typename: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(typename)) next.delete(typename);
      else next.add(typename);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col border-r border-zinc-800">
      <div className="border-b border-zinc-800 p-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${Object.keys(records).length} records`}
          className="w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:bg-zinc-800"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
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
              collapsed={collapsed.has(g.typename)}
              onToggle={() => toggle(g.typename)}
              selectedId={selectedId}
              onSelect={onSelect}
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
  onSelect,
}: {
  group: Group;
  records: RecordSource;
  collapsed: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border-b border-zinc-900">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
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
                onClick={() => onSelect(id)}
                className={`flex w-full flex-col gap-0.5 px-3 py-1 text-left text-xs ${
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
