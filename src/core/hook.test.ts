import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection } from './connect';
import { installHook, type HookHandle } from './hook';
import type { CoreToUi, StorePublish } from '~/shared/protocol';

/**
 * Tests for the hook's replay() behavior. Specifically the
 * version-skip logic added so reconnects after a service-worker
 * hibernation don't re-serialize the entire store every cycle when
 * the panel already has the current snapshot.
 *
 * The `__RELAY_DEVTOOLS_HOOK__` slot is reset before every test so
 * each installHook() actually installs rather than no-op'ing. The
 * module-level envId counter increments across tests; that's fine —
 * we read envIds out of the captured messages rather than asserting
 * specific values.
 */

type RelayStoreLike = {
  __log?: ((event: { name: string; [key: string]: unknown }) => void) | null;
  getSource?: () => unknown;
};

type RelayEnvLike = {
  getStore?: () => RelayStoreLike;
};

function makeFakeEnv(initialRecords: Record<string, unknown>): RelayEnvLike & {
  setRecords(next: Record<string, unknown>): void;
  fireStorePublish(): void;
} {
  let records = initialRecords;
  let logHandler: RelayStoreLike['__log'] = null;
  const store: RelayStoreLike = {
    get __log() {
      return logHandler;
    },
    set __log(fn) {
      logHandler = fn;
    },
    getSource: () => ({ toJSON: () => records }),
  };
  return {
    getStore: () => store,
    setRecords(next) {
      records = next;
    },
    fireStorePublish() {
      logHandler?.({ name: 'store.publish' });
    },
  };
}

function captureConnection(): Connection & { sent: CoreToUi[] } {
  const sent: CoreToUi[] = [];
  return {
    sent,
    send(msg) {
      sent.push(msg);
    },
  };
}

function findHook() {
  return (
    globalThis as {
      __RELAY_DEVTOOLS_HOOK__?: {
        registerEnvironment: (e: RelayEnvLike) => void;
      };
    }
  ).__RELAY_DEVTOOLS_HOOK__;
}

beforeEach(() => {
  delete (globalThis as { __RELAY_DEVTOOLS_HOOK__?: unknown })
    .__RELAY_DEVTOOLS_HOOK__;
});

describe('installHook', () => {
  it('exposes registerEnvironment on globalThis', () => {
    installHook(captureConnection());
    const hook = findHook();
    expect(hook).toBeDefined();
    expect(typeof hook!.registerEnvironment).toBe('function');
  });

  it('returns a no-op handle when called a second time', () => {
    installHook(captureConnection());
    const second = installHook(captureConnection());
    // Calling replay on the no-op handle is safe and does nothing.
    expect(() => second.replay()).not.toThrow();
  });
});

describe('attach via registerEnvironment', () => {
  it('emits environment.registered and an initial store.publish at version 1', () => {
    const conn = captureConnection();
    installHook(conn);
    const env = makeFakeEnv({
      'A:1': { __id: 'A:1', __typename: 'A', name: 'first' },
    });
    findHook()!.registerEnvironment(env);

    expect(conn.sent).toHaveLength(2);
    expect(conn.sent[0]).toMatchObject({ type: 'environment.registered' });
    expect(conn.sent[1]).toMatchObject({ type: 'store.publish', version: 1 });
  });

  it('bumps version on each subsequent store.publish', () => {
    const conn = captureConnection();
    installHook(conn);
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);

    env.setRecords({ 'A:1': { __id: 'A:1', __typename: 'A', n: 1 } });
    env.fireStorePublish();
    env.setRecords({ 'A:1': { __id: 'A:1', __typename: 'A', n: 2 } });
    env.fireStorePublish();

    const publishes = conn.sent.filter(
      (m): m is StorePublish => m.type === 'store.publish',
    );
    expect(publishes.map((p) => p.version)).toEqual([1, 2, 3]);
  });
});

describe('replay', () => {
  function setup() {
    const conn = captureConnection();
    const handle: HookHandle = installHook(conn);
    return { conn, handle };
  }

  it('is a no-op when no envs have registered', () => {
    const { conn, handle } = setup();
    handle.replay();
    expect(conn.sent).toEqual([]);
  });

  it('re-emits environment.registered + store.publish at the current version when no knownVersions is provided', () => {
    const { conn, handle } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    // Initial attach: registered + publish v1
    const initial = conn.sent.slice();
    expect(initial).toHaveLength(2);
    conn.sent.length = 0;

    handle.replay();

    const publish = conn.sent.find(
      (m): m is StorePublish => m.type === 'store.publish',
    );
    expect(publish).toBeDefined();
    // Same version as the last real publish — replay does NOT bump.
    expect(publish!.version).toBe(1);
    expect(conn.sent[0]).toMatchObject({ type: 'environment.registered' });
  });

  it('skips store.publish when knownVersions matches the current version', () => {
    const { conn, handle } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    const registered = conn.sent[0];
    expect(registered.type).toBe('environment.registered');
    const envId =
      registered.type === 'environment.registered' ? registered.envId : '';
    conn.sent.length = 0;

    handle.replay({ [envId]: 1 });

    // Only the lightweight registered message; publish is skipped.
    expect(conn.sent).toHaveLength(1);
    expect(conn.sent[0]).toMatchObject({ type: 'environment.registered' });
  });

  it('emits store.publish when knownVersions is stale', () => {
    const { conn, handle } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    env.fireStorePublish(); // bumps to v2
    env.fireStorePublish(); // bumps to v3
    const registered = conn.sent[0];
    const envId =
      registered.type === 'environment.registered' ? registered.envId : '';
    conn.sent.length = 0;

    handle.replay({ [envId]: 1 });

    const publish = conn.sent.find(
      (m): m is StorePublish => m.type === 'store.publish',
    );
    expect(publish).toBeDefined();
    expect(publish!.version).toBe(3);
  });

  it('emits store.publish when the env is unknown to the panel', () => {
    const { conn, handle } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    conn.sent.length = 0;

    // Panel has nothing for this env (e.g., it just opened).
    handle.replay({});

    const publish = conn.sent.find(
      (m): m is StorePublish => m.type === 'store.publish',
    );
    expect(publish).toBeDefined();
    expect(publish!.version).toBe(1);
  });

  it('does not bump the version counter on a replayed publish', () => {
    const { conn, handle } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    const registered = conn.sent[0];
    const envId =
      registered.type === 'environment.registered' ? registered.envId : '';

    // Replay with stale version → emits another publish, but the next
    // real store.publish should still be version 2 (not 3 — the replay
    // didn't advance the counter).
    handle.replay({});
    conn.sent.length = 0;
    env.fireStorePublish();

    const publish = conn.sent.find(
      (m): m is StorePublish => m.type === 'store.publish',
    );
    expect(publish).toBeDefined();
    // Real publishes advance: 1 (initial) → 2 (this one). Replay
    // emissions don't count.
    expect(publish!.version).toBe(2);
    expect(publish!.envId).toBe(envId);
  });

  it('handles multiple envs with a mix of matching and stale versions', () => {
    const { conn, handle } = setup();
    const env1 = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    const env2 = makeFakeEnv({ 'B:1': { __id: 'B:1', __typename: 'B' } });
    findHook()!.registerEnvironment(env1);
    findHook()!.registerEnvironment(env2);
    env2.fireStorePublish(); // env2 is now at v2

    const env1Id = (conn.sent[0] as { envId: string }).envId;
    const env2Id = (conn.sent[2] as { envId: string }).envId;
    conn.sent.length = 0;

    handle.replay({ [env1Id]: 1 /* matches */, [env2Id]: 1 /* stale */ });

    const publishes = conn.sent.filter(
      (m): m is StorePublish => m.type === 'store.publish',
    );
    expect(publishes).toHaveLength(1);
    expect(publishes[0]!.envId).toBe(env2Id);
    expect(publishes[0]!.version).toBe(2);
  });
});
