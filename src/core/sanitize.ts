import type { StoreRecord, RecordSource } from '~/shared/protocol';

/**
 * Turn a live Relay RecordSource (or anything that quacks like one) into
 * a plain-JSON snapshot safe to send over the wire. Drops functions,
 * symbols, and DOM nodes; calls toJSON() when available; tolerates
 * cycles by short-circuiting on a WeakSet.
 *
 * The shape we emit matches `RecordSource` in src/shared/protocol.ts:
 * a record-id → record map, where each record has at minimum `__id`
 * and `__typename`.
 */

type RecordSourceLike = {
  toJSON?: () => unknown;
  get?: (id: string) => unknown;
  getRecordIDs?: () => string[];
  [key: string]: unknown;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

function cloneValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return cloneValue((value as { toJSON: () => unknown }).toJSON(), seen);
  }
  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((v) => cloneValue(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as object)) {
    if (typeof v === 'function' || typeof v === 'symbol') continue;
    if (typeof Node !== 'undefined' && v instanceof Node) continue;
    out[k] = cloneValue(v, seen);
  }
  return out;
}

export function sanitizeRecordSource(source: unknown): RecordSource {
  const seen = new WeakSet<object>();

  // Most Relay RecordSources have toJSON() → flat id-keyed map of records.
  if (
    isObject(source) &&
    typeof (source as RecordSourceLike).toJSON === 'function'
  ) {
    const json = (source as RecordSourceLike).toJSON!();
    return (cloneValue(json, seen) as RecordSource) ?? {};
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
      out[id] = cloneValue(rec, seen) as StoreRecord | null;
    }
    return out as RecordSource;
  }

  // Last resort: it's already plain JSON-looking, clone defensively.
  return (cloneValue(source, seen) as RecordSource) ?? {};
}
