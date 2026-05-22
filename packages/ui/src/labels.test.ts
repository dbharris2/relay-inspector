import { describe, expect, it } from 'vitest';
import { getRecordLabel, shortenId } from './labels';

describe('getRecordLabel', () => {
  it('returns null for null / undefined records', () => {
    expect(getRecordLabel(null)).toBeNull();
    expect(getRecordLabel(undefined)).toBeNull();
  });

  it('returns null when no name-ish field exists', () => {
    expect(getRecordLabel({ __id: 'A', __typename: 'T', count: 3 })).toBeNull();
  });

  it('picks `name` first', () => {
    const label = getRecordLabel({
      __id: 'A',
      __typename: 'T',
      name: 'first',
      title: 'second',
      label: 'third',
    });
    expect(label).toBe('first');
  });

  it('falls back through the priority list', () => {
    // name > displayName > fullName > title > label > username > handle
    // > email > slug > body > value > __resolverValue
    expect(getRecordLabel({ __id: 'A', __typename: 'T', title: 't' })).toBe(
      't',
    );
    expect(
      getRecordLabel({ __id: 'A', __typename: 'T', email: 'e@x.com' }),
    ).toBe('e@x.com');
    expect(
      getRecordLabel({ __id: 'A', __typename: 'T', body: 'message body' }),
    ).toBe('message body');
    expect(
      getRecordLabel({ __id: 'A', __typename: 'T', __resolverValue: 'r' }),
    ).toBe('r');
  });

  it('skips empty-string candidates', () => {
    const label = getRecordLabel({
      __id: 'A',
      __typename: 'T',
      name: '',
      title: 'fallback',
    });
    expect(label).toBe('fallback');
  });

  it('skips non-string candidates', () => {
    const label = getRecordLabel({
      __id: 'A',
      __typename: 'T',
      // `value` is in the priority list but only matters as a string.
      // A number here should be ignored in favor of title.
      value: 42,
      title: 'used',
    });
    expect(label).toBe('used');
  });

  it('skips overly-long strings (likely full text bodies, not labels)', () => {
    const long = 'x'.repeat(100);
    const label = getRecordLabel({
      __id: 'A',
      __typename: 'T',
      name: long,
      title: 'short',
    });
    expect(label).toBe('short');
  });
});

describe('shortenId', () => {
  it('strips a `client:` prefix', () => {
    expect(shortenId('client:abc')).toBe('abc');
  });

  it('leaves other prefixes alone', () => {
    expect(shortenId('User:123')).toBe('User:123');
    expect(shortenId('record:42')).toBe('record:42');
  });

  it('returns the input unchanged when shorter than max', () => {
    expect(shortenId('Post:42')).toBe('Post:42');
  });

  it('truncates with an ellipsis when over max', () => {
    const long = 'a'.repeat(40);
    const out = shortenId(long, 10);
    expect(out).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, -1)).toBe('a'.repeat(9));
  });

  it('measures the threshold against the post-strip length', () => {
    // 'client:' is 7 chars; without it 'abcdef' is 6, under default max
    expect(shortenId('client:abcdef')).toBe('abcdef');
  });

  it('defaults max to 32', () => {
    const long = 'b'.repeat(50);
    expect(shortenId(long)).toHaveLength(32);
  });
});
