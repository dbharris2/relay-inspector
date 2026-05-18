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

export function installHook(connection: Connection): void {
  const g = globalThis as GlobalWithHook;
  if (g.__RELAY_DEVTOOLS_HOOK__?.isInjected) return;

  const versions = new Map<string, number>();

  function publish(env: RelayEnvironmentLike) {
    const envId = idFor(env);
    const source = env.getStore?.().getSource?.();
    if (source == null) return;
    const version = (versions.get(envId) ?? 0) + 1;
    versions.set(envId, version);
    connection.send({
      type: 'store.publish',
      envId,
      version,
      records: sanitizeRecordSource(source),
    });
  }

  function attach(env: RelayEnvironmentLike) {
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
}
