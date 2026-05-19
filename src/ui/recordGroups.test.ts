import { describe, expect, it } from 'vitest';
import type { RecordSource } from '~/shared/protocol';
import { buildGroups } from './recordGroups';

function rs(
  ...entries: Array<{ id: string; typename?: string; [k: string]: unknown }>
): RecordSource {
  const out: { [id: string]: NonNullable<RecordSource[string]> } = {};
  for (const { id, typename = 'T', ...rest } of entries) {
    out[id] = { __id: id, __typename: typename, ...rest };
  }
  return out as RecordSource;
}

describe('buildGroups', () => {
  it('returns empty array for empty input', () => {
    expect(buildGroups({}, '')).toEqual([]);
  });

  it('groups by __typename', () => {
    const groups = buildGroups(
      rs(
        { id: 'A:1', typename: 'A' },
        { id: 'B:1', typename: 'B' },
        { id: 'A:2', typename: 'A' },
      ),
      '',
    );
    expect(groups).toEqual([
      { typename: 'A', ids: ['A:1', 'A:2'] },
      { typename: 'B', ids: ['B:1'] },
    ]);
  });

  it('sorts groups alphabetically by typename', () => {
    const groups = buildGroups(
      rs(
        { id: 'Z:1', typename: 'Zebra' },
        { id: 'A:1', typename: 'Aardvark' },
        { id: 'M:1', typename: 'Mole' },
      ),
      '',
    );
    expect(groups.map((g) => g.typename)).toEqual([
      'Aardvark',
      'Mole',
      'Zebra',
    ]);
  });

  it('sorts records within a group by their friendly label', () => {
    // No name field → falls back to id; the test record with `name`
    // uses that for ordering.
    const groups = buildGroups(
      rs(
        { id: 'U:3', typename: 'User', name: 'Alice' },
        { id: 'U:1', typename: 'User', name: 'Charlie' },
        { id: 'U:2', typename: 'User', name: 'Bob' },
      ),
      '',
    );
    expect(groups[0]!.ids).toEqual(['U:3', 'U:2', 'U:1']);
  });

  it('falls back to id-ordering when no label is derivable', () => {
    const groups = buildGroups(
      rs(
        { id: 'B', typename: 'T' },
        { id: 'A', typename: 'T' },
        { id: 'C', typename: 'T' },
      ),
      '',
    );
    expect(groups[0]!.ids).toEqual(['A', 'B', 'C']);
  });

  it('skips null record entries', () => {
    const groups = buildGroups(
      { 'A:1': null, 'A:2': { __id: 'A:2', __typename: 'A', name: 'x' } },
      '',
    );
    expect(groups).toEqual([{ typename: 'A', ids: ['A:2'] }]);
  });

  it("buckets records with missing __typename as '(unknown)'", () => {
    const groups = buildGroups(
      // No __typename on this record (cast away the type to construct
      // a degenerate but possible wire payload).
      { 'X:1': { __id: 'X:1' } as never },
      '',
    );
    expect(groups).toEqual([{ typename: '(unknown)', ids: ['X:1'] }]);
  });

  describe('search', () => {
    const all = rs(
      { id: 'User:1', typename: 'User', name: 'Ada Lovelace' },
      { id: 'User:2', typename: 'User', name: 'Grace Hopper' },
      { id: 'Post:1', typename: 'Post', title: 'About Ada' },
      { id: 'Post:2', typename: 'Post', title: 'Misc' },
    );

    it('returns everything when search is empty', () => {
      const groups = buildGroups(all, '');
      const total = groups.reduce((n, g) => n + g.ids.length, 0);
      expect(total).toBe(4);
    });

    it('matches against id substring', () => {
      const groups = buildGroups(all, 'User:1');
      expect(groups).toEqual([{ typename: 'User', ids: ['User:1'] }]);
    });

    it('matches against typename substring', () => {
      const groups = buildGroups(all, 'post');
      expect(groups.map((g) => g.typename)).toEqual(['Post']);
      expect(groups[0]!.ids.length).toBe(2);
    });

    it('matches against label substring', () => {
      const groups = buildGroups(all, 'Ada');
      // Matches User:1 (name: 'Ada Lovelace') and Post:1 (title: 'About Ada').
      const flat = groups.flatMap((g) => g.ids).sort();
      expect(flat).toEqual(['Post:1', 'User:1']);
    });

    it('is case-insensitive', () => {
      expect(buildGroups(all, 'GRACE').flatMap((g) => g.ids)).toEqual([
        'User:2',
      ]);
    });

    it('omits groups that have no matching records', () => {
      const groups = buildGroups(all, 'Grace');
      expect(groups.map((g) => g.typename)).toEqual(['User']);
    });

    it('returns empty array when nothing matches', () => {
      expect(buildGroups(all, 'nonexistent_xyz')).toEqual([]);
    });
  });
});
