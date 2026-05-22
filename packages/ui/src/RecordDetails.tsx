import { useState } from 'react';
import type { RecordSource } from '@relay-inspector/core/protocol';
import { getRecordLabel, shortenId } from './labels';

export type Props = {
  records: RecordSource;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function RecordDetails({ records, selectedId, onSelect }: Props) {
  if (selectedId == null) {
    return (
      <div className="grid h-full place-items-center text-xs text-zinc-500">
        Select a record on the left.
      </div>
    );
  }
  const record = records[selectedId];
  if (record == null) {
    return (
      <div className="grid h-full place-items-center text-xs text-zinc-500">
        Record {selectedId} not in the store.
      </div>
    );
  }

  // Pull __id/__typename out of the field list — they go in the header.
  const fields = Object.entries(record).filter(
    ([k]) => k !== '__id' && k !== '__typename',
  );
  fields.sort(([a], [b]) => a.localeCompare(b));

  const label = getRecordLabel(record);

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <header className="border-b border-zinc-800 p-3">
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
            {record.__typename}
          </span>
          {label != null && (
            <span className="text-sm font-medium text-zinc-100">{label}</span>
          )}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500" title={record.__id}>
          {record.__id}
        </div>
      </header>

      <div className="overflow-y-auto px-2 py-2">
        {fields.length === 0 ? (
          <div className="px-2 text-xs text-zinc-500">No fields.</div>
        ) : (
          fields.map(([key, value]) => (
            <Field
              key={key}
              keyName={key}
              value={value}
              depth={0}
              records={records}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

type FieldProps = {
  keyName: string;
  value: unknown;
  depth: number;
  records: RecordSource;
  onSelect: (id: string) => void;
};

function Field({ keyName, value, depth, records, onSelect }: FieldProps) {
  const indent = depth * 12;
  const ref = asRef(value);
  const refs = asRefs(value);

  if (ref != null) {
    return (
      <Row indent={indent}>
        <KeyName name={keyName} />
        <RefChip id={ref} records={records} onSelect={onSelect} />
      </Row>
    );
  }

  if (refs != null) {
    return (
      <Group keyName={keyName} indent={indent} count={refs.length}>
        {(open) =>
          open && (
            <div>
              {refs.map((id, idx) => (
                <Row key={idx} indent={indent + 12}>
                  <span className="text-zinc-500">{idx}</span>
                  <RefChip id={id} records={records} onSelect={onSelect} />
                </Row>
              ))}
            </div>
          )
        }
      </Group>
    );
  }

  if (Array.isArray(value)) {
    return (
      <Group keyName={keyName} indent={indent} count={value.length}>
        {(open) =>
          open &&
          value.map((item, idx) => (
            <Field
              key={idx}
              keyName={String(idx)}
              value={item}
              depth={depth + 1}
              records={records}
              onSelect={onSelect}
            />
          ))
        }
      </Group>
    );
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <Group keyName={keyName} indent={indent} count={entries.length}>
        {(open) =>
          open &&
          entries.map(([k, v]) => (
            <Field
              key={k}
              keyName={k}
              value={v}
              depth={depth + 1}
              records={records}
              onSelect={onSelect}
            />
          ))
        }
      </Group>
    );
  }

  return (
    <Row indent={indent}>
      <KeyName name={keyName} />
      <Scalar value={value} />
    </Row>
  );
}

function Group({
  keyName,
  indent,
  count,
  children,
}: {
  keyName: string;
  indent: number;
  count: number;
  // children is rendered with the open state — same pattern as a
  // render prop so we don't render heavy subtrees while collapsed.
  children: (open: boolean) => React.ReactNode;
}) {
  // Top-level fields default open; nested ones default closed.
  const [open, setOpen] = useState(indent === 0);
  return (
    <div>
      <Row indent={indent} onClick={() => setOpen(!open)} clickable>
        <Chevron open={open} />
        <KeyName name={keyName} />
        <span className="text-[10px] text-zinc-500">
          {count} {count === 1 ? 'field' : 'fields'}
        </span>
      </Row>
      {children(open)}
    </div>
  );
}

function Row({
  indent,
  children,
  clickable,
  onClick,
}: {
  indent: number;
  children: React.ReactNode;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{ paddingLeft: indent + 8 }}
      className={`flex items-center gap-2 py-0.5 pr-2 text-xs ${
        clickable ? 'cursor-pointer hover:bg-zinc-900' : ''
      }`}
    >
      {children}
    </div>
  );
}

function KeyName({ name }: { name: string }) {
  return <span className="font-medium text-zinc-300">{name}</span>;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-block w-2 select-none text-zinc-500 transition-transform ${
        open ? 'rotate-90' : ''
      }`}
    >
      ▸
    </span>
  );
}

function Scalar({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-zinc-500 italic">null</span>;
  }
  if (typeof value === 'string') {
    return <span className="text-emerald-400">"{value}"</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-amber-300">{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-rose-300">{String(value)}</span>;
  }
  if (typeof value === 'undefined') {
    return <span className="text-zinc-500 italic">undefined</span>;
  }
  return <span className="text-zinc-400">{String(value)}</span>;
}

function RefChip({
  id,
  records,
  onSelect,
}: {
  id: string;
  records: RecordSource;
  onSelect: (id: string) => void;
}) {
  const target = records[id];
  const label = getRecordLabel(target);
  const exists = target != null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (exists) onSelect(id);
      }}
      disabled={!exists}
      title={id}
      className={`group inline-flex items-center gap-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] ${
        exists
          ? 'cursor-pointer hover:bg-sky-900/50 hover:text-sky-100'
          : 'cursor-not-allowed opacity-60'
      }`}
    >
      <span className="text-[10px] font-semibold text-zinc-400 group-hover:text-sky-200">
        {target?.__typename ?? '?'}
      </span>
      <span className="text-zinc-100">{label ?? shortenId(id, 24)}</span>
    </button>
  );
}

// A field value is a reference iff it looks like { __ref: string }.
// (No other keys; otherwise treat it as a plain object so we don't
// hide unexpected data.)
function asRef(value: unknown): string | null {
  if (value == null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.__ref === 'string' && Object.keys(obj).length === 1) {
    return obj.__ref;
  }
  return null;
}

// Same for { __refs: string[] }.
function asRefs(value: unknown): string[] | null {
  if (value == null || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (
    Array.isArray(obj.__refs) &&
    obj.__refs.every((r) => typeof r === 'string') &&
    Object.keys(obj).length === 1
  ) {
    return obj.__refs as string[];
  }
  return null;
}
