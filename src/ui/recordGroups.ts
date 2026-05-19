import type { RecordSource } from '~/shared/protocol';
import { getRecordLabel } from './labels';

export type RecordGroup = {
  typename: string;
  ids: string[];
};

/**
 * Group records by `__typename` for the left pane's display order:
 *
 *   - Each non-null record contributes its id to the bucket for its
 *     `__typename` (or `(unknown)` if the typename is missing).
 *   - Buckets are alphabetized by typename.
 *   - Within a bucket, ids are alphabetized by their friendly label
 *     (or by id when no label is derivable).
 *
 * `search` is an optional substring filter, matched case-insensitively
 * against any of: the record id, its typename, or its label. Empty
 * search returns every record.
 */
export function buildGroups(
  records: RecordSource,
  search: string,
): RecordGroup[] {
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

  const groups: RecordGroup[] = [];
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
