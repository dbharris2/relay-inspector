import type { Connection } from './connect';
import { sanitizeRecordSource } from './sanitize';

/**
 * Installs `window.__RELAY_DEVTOOLS_HOOK__` and wires environments
 * registered with it to a Connection.
 *
 * We deliberately reuse Relay's existing devtools-hook name so any
 * Relay environment auto-detects us without user wiring. If the
 * official Relay DevTools have already installed a hook, we leave it
 * alone — the user can pick one.
 */

type RelayEnvironmentLike = {
  __log?: (event: { name: string; [key: string]: unknown }) => void;
  getStore?: () => { getSource?: () => unknown };
};

type DevtoolsHook = {
  isInjected: true;
  /** Called by Relay when a new environment is constructed. */
  inject(env: RelayEnvironmentLike): void;
};

declare global {
  interface Window {
    __RELAY_DEVTOOLS_HOOK__?: DevtoolsHook;
  }
}

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
  if (typeof window === 'undefined') return;
  if (window.__RELAY_DEVTOOLS_HOOK__?.isInjected) return;

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
    publish(env);

    const originalLog = env.__log;
    env.__log = (event) => {
      try {
        originalLog?.(event);
      } finally {
        if (event?.name === 'store.publish') publish(env);
      }
    };
  }

  window.__RELAY_DEVTOOLS_HOOK__ = {
    isInjected: true,
    inject: attach,
  };
}
