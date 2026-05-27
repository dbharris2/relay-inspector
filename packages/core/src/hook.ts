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
 * Returns a handle the Chrome-extension deploy uses to gate work on
 * panel presence: `setPanelConnected(true)` lets sanitize+send run
 * (and `replay()` re-emits the current snapshot for every env);
 * `setPanelConnected(false)` suspends sanitize+send so a Relay app
 * loaded in any tab doesn't pay ~1s of main-thread time per
 * store.publish when nobody's watching. The standalone deploy stays
 * always-on by leaving the default alone.
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
   * Re-emit environment.registered + the current store.publish for
   * every env the hook knows about. No-op if no envs have registered.
   * Used by the extension deploy when a panel attaches so it doesn't
   * sit on an empty state until the next publish fires.
   */
  replay(): void;
  /**
   * Toggle whether the hook does any sanitize+send work on
   * store.publish. The extension flips this off whenever no panel is
   * watching — Chrome content scripts run on every page, and a full
   * RecordSource walk per publish on a heavy Relay app is ~1s of
   * main-thread time we don't want to pay when nobody's listening.
   *
   * The version counter still advances while suspended so replay()
   * emits the latest snapshot when a panel later attaches.
   *
   * Defaults to true so the standalone deploy (which has no
   * panel-presence signal) stays in its always-on mode.
   */
  setPanelConnected(connected: boolean): void;
};

const NOOP_HANDLE: HookHandle = {
  replay: () => {},
  setPanelConnected: () => {},
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

export function installHook(connection: Connection): HookHandle {
  const g = globalThis as GlobalWithHook;
  // Bail if anything already owns the slot. The official relay-devtools
  // extension (relayjs/relay-devtools) installs its hook as a
  // getter-only property descriptor, so a plain assignment would throw
  // TypeError in strict mode and bubble out of main-world.ts as an
  // uncaught error, breaking the page. `hasOwnProperty` matches the
  // same gate the official extension uses to detect us.
  if (Object.prototype.hasOwnProperty.call(g, '__RELAY_DEVTOOLS_HOOK__')) {
    return NOOP_HANDLE;
  }

  const versions = new Map<string, number>();
  // Iterable mirror of `envIds` so replay() can walk every env.
  // WeakMap isn't iterable; we'd otherwise have nothing to replay
  // against. Holding strong refs here is fine in practice because the
  // hook lives in the same JS world as the environments and they
  // share a lifetime — there's no leak across page navigations,
  // either, since the whole main-world script reloads with the page.
  const knownEnvs = new Set<RelayEnvironmentLike>();
  // Default to true so the standalone WS deploy, which has no
  // panel-presence signal, stays in its always-on mode. The extension
  // flips this to false right after install and lets the background
  // service worker drive it from there.
  let panelConnected = true;

  /**
   * Send the current snapshot for `env`. `bumpVersion` is true for
   * fresh store.publish events (the version counter advances); false
   * for replays (we re-emit the same version we last sent so the
   * panel doesn't redundantly process the same data).
   *
   * The version bumps even while the panel is disconnected so that
   * a later replay() correctly emits the current state.
   */
  function emitSnapshot(env: RelayEnvironmentLike, bumpVersion: boolean) {
    const envId = idFor(env);
    const source = env.getStore?.().getSource?.();
    if (source == null) return;
    const prev = versions.get(envId) ?? 0;
    const version = bumpVersion ? prev + 1 : prev;
    if (bumpVersion) versions.set(envId, version);
    if (!panelConnected) return;
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
    // environment.registered is tiny (just an envId); send it
    // unconditionally so the upstream content port opens and the
    // background service worker learns this tab has a Relay app even
    // if the panel isn't watching yet.
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

  try {
    g.__RELAY_DEVTOOLS_HOOK__ = {
      isInjected: true,
      registerEnvironment: attach,
    };
  } catch {
    // Some sites lock `__RELAY_DEVTOOLS_HOOK__` down (e.g. with a
    // getter-only property descriptor on `window`) to block devtools
    // injection. Plain assignment throws TypeError in strict mode and
    // would otherwise escape main-world.ts as an uncaught error,
    // breaking the page. Bail out as a no-op and leave the page alone.
    return NOOP_HANDLE;
  }

  return {
    replay() {
      for (const env of knownEnvs) {
        const envId = idFor(env);
        connection.send({ type: 'environment.registered', envId });

        // Nothing to send if we've never recorded a publish for this
        // env (e.g. its store was missing at attach time).
        const current = versions.get(envId) ?? 0;
        if (current === 0) continue;

        emitSnapshot(env, false);
      }
    },
    setPanelConnected(connected) {
      panelConnected = connected;
    },
  };
}
