import type { RecordSource } from '~/shared/protocol';
import { getRecordLabel, shortenId } from './labels';

export type Props = {
  records: RecordSource;
  tabIds: readonly string[];
  previewTabId: string | null;
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
};

export function TabBar({
  records,
  tabIds,
  previewTabId,
  activeTabId,
  onSelect,
  onPin,
  onClose,
}: Props) {
  if (tabIds.length === 0) return null;

  return (
    <div className="flex items-stretch overflow-x-auto border-b border-zinc-800 bg-zinc-900">
      {tabIds.map((id) => {
        const record = records[id];
        const label = getRecordLabel(record);
        const typename = record?.__typename ?? '?';
        const isActive = id === activeTabId;
        const isPreview = id === previewTabId;
        return (
          <div
            key={id}
            className={`group flex shrink-0 select-none items-center gap-1.5 border-r border-zinc-800 ${
              isActive
                ? 'bg-zinc-950 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800/60'
            }`}
          >
            <button
              onClick={() => onSelect(id)}
              onDoubleClick={() => onPin(id)}
              title={
                isPreview ? `${id} — preview tab (double-click to pin)` : id
              }
              className="flex max-w-[220px] items-center gap-1.5 py-1 pl-2 text-xs"
            >
              <span className="text-[10px] font-semibold text-zinc-500">
                {typename}
              </span>
              <span className={`truncate ${isPreview ? 'italic' : ''}`}>
                {label ?? shortenId(id, 18)}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(id);
              }}
              title="Close tab"
              className={`mr-1 flex size-4 shrink-0 items-center justify-center rounded text-sm leading-none text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 ${
                isActive ? 'opacity-80' : 'opacity-0 group-hover:opacity-80'
              }`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
