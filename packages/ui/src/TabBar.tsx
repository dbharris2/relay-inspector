import { useState } from 'react';
import type { RecordSource } from '@relay-inspector/core/protocol';
import { getRecordLabel, shortenId } from './labels';
import { useWheelHorizontalScroll } from './useWheelHorizontalScroll';
import { useHorizontalScrollEdges } from './useHorizontalScrollEdges';

export type Props = {
  records: RecordSource;
  tabIds: readonly string[];
  previewTabId: string | null;
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
};

export function TabBar({
  records,
  tabIds,
  previewTabId,
  activeTabId,
  onSelect,
  onPin,
  onClose,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
}: Props) {
  // Track the scroll container in state (not a ref) so the wheel and
  // edge-tracking effects re-run when it actually mounts.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useWheelHorizontalScroll(scroller);
  const { hasOverflow, canScrollLeft, canScrollRight } =
    useHorizontalScrollEdges(scroller);

  if (tabIds.length === 0) return null;

  const scrollBy = (delta: number) => {
    scroller?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="flex min-w-0 items-stretch border-b border-zinc-800 bg-zinc-900">
      <NavButton
        direction="back"
        disabled={!canGoBack}
        onClick={onGoBack}
        shortcut="⌘["
      />
      <NavButton
        direction="forward"
        disabled={!canGoForward}
        onClick={onGoForward}
        shortcut="⌘]"
      />
      {hasOverflow && (
        <ArrowButton
          direction="left"
          disabled={!canScrollLeft}
          onClick={() => scrollBy(-(scroller?.clientWidth ?? 0) * 0.8)}
        />
      )}
      <div
        ref={setScroller}
        className="no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
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
      {hasOverflow && (
        <ArrowButton
          direction="right"
          disabled={!canScrollRight}
          onClick={() => scrollBy((scroller?.clientWidth ?? 0) * 0.8)}
        />
      )}
    </div>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`Scroll ${direction}`}
      className={`flex w-7 shrink-0 items-center justify-center border-zinc-800 text-zinc-400 ${
        direction === 'left' ? 'border-r' : 'border-l'
      } ${
        disabled
          ? 'cursor-default opacity-30'
          : 'hover:bg-zinc-800/80 hover:text-zinc-100'
      }`}
    >
      {direction === 'left' ? '‹' : '›'}
    </button>
  );
}

function NavButton({
  direction,
  disabled,
  onClick,
  shortcut,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onClick: () => void;
  shortcut: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${direction === 'back' ? 'Back' : 'Forward'} (${shortcut})`}
      className={`flex w-7 shrink-0 items-center justify-center border-r border-zinc-800 text-zinc-400 ${
        disabled
          ? 'cursor-default opacity-30'
          : 'hover:bg-zinc-800/80 hover:text-zinc-100'
      }`}
    >
      {direction === 'back' ? '◂' : '▸'}
    </button>
  );
}
