import { describe, expect, it } from 'vitest';
import { sanitizeRecordSource } from './sanitize';

describe('sanitizeRecordSource', () => {
  describe('plain JSON-like input (last-resort branch)', () => {
    it('passes primitive values through unchanged', () => {
      // The fallback branch hands the value straight to cloneValue.
      // Primitives shouldn't be wrapped or transformed.
      const source = {
        'A:1': { __id: 'A:1', __typename: 'A', n: 42, b: true, s: 'hi' },
      };
      const out = sanitizeRecordSource(source);
      expect(out['A:1']).toEqual({
        __id: 'A:1',
        __typename: 'A',
        n: 42,
        b: true,
        s: 'hi',
      });
    });

    it('deep-clones nested objects and arrays without aliasing the input', () => {
      const record = {
        __id: 'A:1',
        __typename: 'A',
        nested: { foo: { bar: 'baz' } },
        list: [1, { x: 2 }],
      };
      const out = sanitizeRecordSource({ 'A:1': record });
      expect(out['A:1']).toEqual(record);
      expect(out['A:1']).not.toBe(record);
      expect((out['A:1'] as Record<string, unknown>).nested).not.toBe(
        record.nested,
      );
    });

    it('drops functions and symbols from object fields', () => {
      const record = {
        __id: 'A:1',
        __typename: 'A',
        fn: () => 'nope',
        sym: Symbol('nope'),
        keep: 'yes',
      };
      const out = sanitizeRecordSource({ 'A:1': record });
      expect(out['A:1']).toEqual({
        __id: 'A:1',
        __typename: 'A',
        keep: 'yes',
      });
    });

    it("renders true cycles as '[Circular]'", () => {
      // record.self points back to record itself — a real back-edge.
      type Cycle = { __id: string; __typename: string; self?: Cycle };
      const record: Cycle = { __id: 'A:1', __typename: 'A' };
      record.self = record;
      const out = sanitizeRecordSource({ 'A:1': record });
      expect((out['A:1'] as Record<string, unknown>).self).toBe('[Circular]');
    });

    it('does NOT flag DAG-shared subtrees as circular (regression)', () => {
      // The bug: an `ancestors` set that grew for the whole traversal
      // and never shrank caused any object reached through multiple
      // paths to be flagged '[Circular]' on the second visit. Relay
      // records share { __ref: 'X' } objects across connection edges
      // in practice, so this case must clone faithfully.
      const sharedRef = { __ref: 'Target:1' };
      const source = {
        'Edge:1': { __id: 'Edge:1', __typename: 'Edge', node: sharedRef },
        'Edge:2': { __id: 'Edge:2', __typename: 'Edge', node: sharedRef },
        'Edge:3': { __id: 'Edge:3', __typename: 'Edge', node: sharedRef },
      };
      const out = sanitizeRecordSource(source);
      for (const id of ['Edge:1', 'Edge:2', 'Edge:3']) {
        expect((out[id] as Record<string, unknown>).node).toEqual({
          __ref: 'Target:1',
        });
      }
    });
  });

  describe('RecordSource-like input (toJSON branch)', () => {
    it('calls toJSON() to get the flat id-keyed map', () => {
      const json = {
        'User:1': { __id: 'User:1', __typename: 'User', name: 'Ada' },
      };
      const source = { toJSON: () => json };
      const out = sanitizeRecordSource(source);
      expect(out['User:1']).toEqual(json['User:1']);
    });

    it('recursively unwraps nested toJSON()s', () => {
      // Some record sources nest values that themselves expose
      // toJSON; the sanitizer should peel each one until it hits
      // plain data.
      const inner = { name: 'Ada' };
      const wrapped = { toJSON: () => inner };
      const source = {
        toJSON: () => ({
          'User:1': { __id: 'User:1', __typename: 'User', wrapped },
        }),
      };
      const out = sanitizeRecordSource(source);
      expect((out['User:1'] as Record<string, unknown>).wrapped).toEqual({
        name: 'Ada',
      });
    });
  });

  describe('RecordSource-like input (getRecordIDs/get fallback)', () => {
    it('iterates ids and clones each record via get()', () => {
      const data: Record<string, Record<string, unknown>> = {
        'User:1': { __id: 'User:1', __typename: 'User', name: 'Ada' },
        'Post:1': { __id: 'Post:1', __typename: 'Post', title: 'First' },
      };
      const source = {
        getRecordIDs: () => Object.keys(data),
        get: (id: string) => data[id],
      };
      const out = sanitizeRecordSource(source);
      expect(out['User:1']).toEqual(data['User:1']);
      expect(out['Post:1']).toEqual(data['Post:1']);
    });
  });

  describe('miscellany', () => {
    it('returns {} for null source', () => {
      expect(sanitizeRecordSource(null)).toEqual({});
    });

    it('preserves null as a field value (distinct from missing)', () => {
      const out = sanitizeRecordSource({
        'A:1': { __id: 'A:1', __typename: 'A', maybe: null },
      });
      expect((out['A:1'] as Record<string, unknown>).maybe).toBeNull();
    });
  });
});
