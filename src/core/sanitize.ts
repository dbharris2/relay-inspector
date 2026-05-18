import type { StoreRecord, RecordSource } from '~/shared/protocol';

/**
 * Turn a live Relay RecordSource (or anything that quacks like one) into
 * a plain-JSON snapshot safe to send over the wire. Drops functions,
 * symbols, and DOM nodes; calls toJSON() when available; tolerates true
 * cycles.
 *
 * The shape we emit matches `RecordSource` in src/shared/protocol.ts:
 * a record-id → record map, where each record has at minimum `__id`
 * and `__typename`.
 *
 * Cycle detection note: `ancestors` only contains objects on the path
 * from the root to the current node. Entries are removed on exit so
 * that DAG-shaped sharing (an object reachable through multiple paths,
 * which Relay's normalized records do — e.g. shared `__ref` objects
 * across connection edges) is cloned faithfully on each visit instead
 * of being collapsed to `'[Circular]'` after the first.
 */

type RecordSourceLike = {
  toJSON?: () => unknown;
  get?: (id: string) => unknown;
  getRecordIDs?: () => string[];
  [key: string]: unknown;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

function cloneValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return cloneValue((value as { toJSON: () => unknown }).toJSON(), ancestors);
  }
  if (ancestors.has(value as object)) return '[Circular]';
  ancestors.add(value as object);
  try {
    if (Array.isArray(value)) {
      return value.map((v) => cloneValue(v, ancestors));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as object)) {
      if (typeof v === 'function' || typeof v === 'symbol') continue;
      if (typeof Node !== 'undefined' && v instanceof Node) continue;
      out[k] = cloneValue(v, ancestors);
    }
    return out;
  } finally {
    ancestors.delete(value as object);
  }
}

export function sanitizeRecordSource(source: unknown): RecordSource {
  const ancestors = new WeakSet<object>();

  // Most Relay RecordSources have toJSON() → flat id-keyed map of records.
  if (
    isObject(source) &&
    typeof (source as RecordSourceLike).toJSON === 'function'
  ) {
    const json = (source as RecordSourceLike).toJSON!();
    return (cloneValue(json, ancestors) as RecordSource) ?? {};
  }

  // Fallback: iterate via getRecordIDs/get.
  if (
    isObject(source) &&
    typeof (source as RecordSourceLike).getRecordIDs === 'function' &&
    typeof (source as RecordSourceLike).get === 'function'
  ) {
    const ids = (source as RecordSourceLike).getRecordIDs!();
    const out: Record<string, StoreRecord | null> = {};
    for (const id of ids) {
      const rec = (source as RecordSourceLike).get!(id);
      out[id] = cloneValue(rec, ancestors) as StoreRecord | null;
    }
    return out as RecordSource;
  }

  // Last resort: it's already plain JSON-looking, clone defensively.
  return (cloneValue(source, ancestors) as RecordSource) ?? {};
}
