import type { Connection } from './connect';
import { sanitizeRecordSource } from './sanitize';

/**
 * Installs `window.__RELAY_DEVTOOLS_HOOK__` and wires every Relay
 * environment that registers with it.
 *
 * Contract is dictated by relay-runtime's
 * `registerEnvironmentWithDevTools.js`:
 *
 *   const hook = global.__RELAY_DEVTOOLS_HOOK__;
 *   if (hook) hook.registerEnvironment(environment);
 *
 * which is called automatically from `RelayModernEnvironment`'s
 * constructor. So as long as our hook is on `window` before the user's
 * app calls `new Environment(...)`, registration is automatic.
 *
 * Important: `store.publish` events flow through `store.__log`, not
 * `environment.__log`. We patch the store's log to catch them.
 *
 * Returns a handle exposing `replay()`, used by the Chrome-extension
 * deploy to re-emit environment.registered + store.publish for every
 * known env when a freshly-opened devtools panel sends `panel.hello`.
 * The standalone deploy ignores the handle.
 */

type RelayStoreLike = {
  __log?: ((event: { name: string; [key: string]: unknown }) => void) | null;
  getSource?: () => unknown;
};

type RelayEnvironmentLike = {
  getStore?: () => RelayStoreLike;
};

type DevtoolsHook = {
  isInjected: true;
  registerEnvironment(env: RelayEnvironmentLike): void;
};

type GlobalWithHook = typeof globalThis & {
  __RELAY_DEVTOOLS_HOOK__?: DevtoolsHook;
};

export type HookHandle = {
  /**
   * Re-emit environment.registered for every env currently known to
   * the hook, plus a store.publish for any env whose current version
   * doesn't match the panel's recorded version in `knownVersions`.
   * No-op if no envs have registered.
   *
   * The version-aware skip lets reconnects after a service-worker
   * hibernation cycle avoid re-serializing snapshots that haven't
   * changed since the panel last saw them.
   */
  replay(knownVersions?: Readonly<{ [envId: string]: number }>): void;
};

const NOOP_HANDLE: HookHandle = { replay: () => {} };

let envSeq = 0;
const envIds = new WeakMap<RelayEnvironmentLike, string>();

function idFor(env: RelayEnvironmentLike): string {
  let id = envIds.get(env);
  if (id == null) {
    id = `env:${++envSeq}`;
    envIds.set(env, id);
  }
  return id;
}

export function installHook(connection: Connection): HookHandle {
  const g = globalThis as GlobalWithHook;
  if (g.__RELAY_DEVTOOLS_HOOK__?.isInjected) return NOOP_HANDLE;

  const versions = new Map<string, number>();
  // Iterable mirror of `envIds` so replay() can walk every env.
  // WeakMap isn't iterable; we'd otherwise have nothing to replay
  // against. Holding strong refs here is fine in practice because the
  // hook lives in the same JS world as the environments and they
  // share a lifetime — there's no leak across page navigations,
  // either, since the whole main-world script reloads with the page.
  const knownEnvs = new Set<RelayEnvironmentLike>();

  /**
   * Send the current snapshot for `env`. `bumpVersion` is true for
   * fresh store.publish events (the version counter advances); false
   * for replays (we re-emit the same version we last sent so the
   * panel doesn't redundantly process the same data).
   */
  function emitSnapshot(env: RelayEnvironmentLike, bumpVersion: boolean) {
    const envId = idFor(env);
    const source = env.getStore?.().getSource?.();
    if (source == null) return;
    const prev = versions.get(envId) ?? 0;
    const version = bumpVersion ? prev + 1 : prev;
    if (bumpVersion) versions.set(envId, version);
    connection.send({
      type: 'store.publish',
      envId,
      version,
      records: sanitizeRecordSource(source),
    });
  }

  function publish(env: RelayEnvironmentLike) {
    emitSnapshot(env, true);
  }

  function attach(env: RelayEnvironmentLike) {
    if (knownEnvs.has(env)) return;
    knownEnvs.add(env);

    const envId = idFor(env);
    connection.send({ type: 'environment.registered', envId });

    const store = env.getStore?.();
    if (store == null) return;

    publish(env);

    const originalLog = store.__log;
    store.__log = (event) => {
      try {
        originalLog?.(event);
      } finally {
        if (event?.name === 'store.publish') publish(env);
      }
    };
  }

  g.__RELAY_DEVTOOLS_HOOK__ = {
    isInjected: true,
    registerEnvironment: attach,
  };

  return {
    replay(knownVersions) {
      for (const env of knownEnvs) {
        const envId = idFor(env);
        connection.send({ type: 'environment.registered', envId });

        const current = versions.get(envId) ?? 0;
        // Nothing to send if we've never published a snapshot for
        // this env (e.g. its store was missing at attach time).
        if (current === 0) continue;
        // Panel already has the current version — skip the heavy
        // sanitize + serialize + send.
        if (knownVersions?.[envId] === current) continue;

        emitSnapshot(env, false);
      }
    },
  };
}
