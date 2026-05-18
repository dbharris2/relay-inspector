import type { StoreRecord } from '~/shared/protocol';

/**
 * Pick a short human-readable label for a record. The order of
 * candidate fields is heuristic: try the obvious "name-shaped" fields
 * first, then any other short string field. Returns null when nothing
 * looks like a usable label.
 *
 * "client:VXNlcjo1ZDU0My00NGVi..." → "Ada Lovelace"
 * "Post:1" → "First post"
 */
const NAME_FIELDS = [
  'name',
  'displayName',
  'fullName',
  'title',
  'label',
  'username',
  'handle',
  'email',
  'slug',
];

export function getRecordLabel(
  record: StoreRecord | null | undefined,
): string | null {
  if (record == null) return null;
  for (const field of NAME_FIELDS) {
    const value = record[field];
    if (typeof value === 'string' && value.length > 0 && value.length < 80) {
      return value;
    }
  }
  return null;
}

/**
 * Compact record ID for display when there's nothing better. Strips
 * the `client:` prefix that Relay puts on hashed global IDs, and
 * truncates very long IDs with an ellipsis.
 */
export function shortenId(id: string, max = 32): string {
  const stripped = id.startsWith('client:') ? id.slice('client:'.length) : id;
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max - 1) + '…';
}
