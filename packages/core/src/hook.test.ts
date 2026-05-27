import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection } from './connect';
import { installHook, type HookHandle } from './hook';
import type { CoreToUi, StorePublish } from './protocol';

/**
 * Tests for the hook's attach, replay, and panel-presence gating.
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

  it('bails out when another devtools extension already owns the hook slot', () => {
    // The official relayjs/relay-devtools extension installs
    // __RELAY_DEVTOOLS_HOOK__ as a getter-only property descriptor on
    // window. If a user has both extensions enabled, plain assignment
    // here would throw TypeError in strict mode and break the page.
    // hasOwnProperty matches the gate the official extension uses to
    // detect us; we mirror it.
    Object.defineProperty(globalThis, '__RELAY_DEVTOOLS_HOOK__', {
      get: () => ({ registerEnvironment: () => {} }),
      configurable: true,
    });
    const conn = captureConnection();
    expect(() => installHook(conn)).not.toThrow();
    expect(conn.sent).toEqual([]);
    delete (globalThis as { __RELAY_DEVTOOLS_HOOK__?: unknown })
      .__RELAY_DEVTOOLS_HOOK__;
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

  it('re-emits environment.registered + store.publish at the current version', () => {
    const { conn, handle } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    expect(conn.sent).toHaveLength(2);
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

  it('does not bump the version counter on a replayed publish', () => {
    const { conn, handle } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    const registered = conn.sent[0];
    const envId =
      registered.type === 'environment.registered' ? registered.envId : '';

    handle.replay();
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
});

describe('panel-presence gating', () => {
  function setup() {
    const conn = captureConnection();
    const handle: HookHandle = installHook(conn);
    return { conn, handle };
  }

  it('skips store.publish payloads while suspended', () => {
    const { conn, handle } = setup();
    handle.setPanelConnected(false);
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);

    // env.registered always goes through (it opens the port and is
    // tiny); store.publish payloads must NOT — that's the whole point.
    expect(conn.sent.find((m) => m.type === 'store.publish')).toBeUndefined();
    expect(
      conn.sent.find((m) => m.type === 'environment.registered'),
    ).toBeDefined();

    env.fireStorePublish();
    env.fireStorePublish();
    expect(conn.sent.filter((m) => m.type === 'store.publish')).toHaveLength(0);
  });

  it('still bumps versions while suspended so replay emits the current snapshot', () => {
    const { conn, handle } = setup();
    handle.setPanelConnected(false);
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    env.fireStorePublish();
    env.fireStorePublish();
    conn.sent.length = 0;

    handle.setPanelConnected(true);
    handle.replay();

    const publish = conn.sent.find(
      (m): m is StorePublish => m.type === 'store.publish',
    );
    expect(publish).toBeDefined();
    // attach() = v1, two fireStorePublish() = v2, v3.
    expect(publish!.version).toBe(3);
  });

  it('resumes sending when reconnected and skips again after another goodbye', () => {
    const { conn, handle } = setup();
    handle.setPanelConnected(false);
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    conn.sent.length = 0;

    handle.setPanelConnected(true);
    env.fireStorePublish();
    expect(conn.sent.filter((m) => m.type === 'store.publish')).toHaveLength(1);

    conn.sent.length = 0;
    handle.setPanelConnected(false);
    env.fireStorePublish();
    expect(conn.sent.filter((m) => m.type === 'store.publish')).toHaveLength(0);
  });

  it('defaults to connected so the standalone deploy is unaffected', () => {
    const { conn } = setup();
    const env = makeFakeEnv({ 'A:1': { __id: 'A:1', __typename: 'A' } });
    findHook()!.registerEnvironment(env);
    // Initial publish goes out without anyone calling setPanelConnected.
    expect(conn.sent.filter((m) => m.type === 'store.publish')).toHaveLength(1);
  });
});
