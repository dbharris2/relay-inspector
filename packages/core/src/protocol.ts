/**
 * Wire protocol shared between the injected core script (running in the
 * user's app) and the inspector UI (running in a browser tab served by
 * the local CLI).
 *
 * Keep this file dependency-free so both sides can import it without
 * dragging in React, Node, or anything else.
 */

export type EnvironmentId = string;

export type StoreRecord = Readonly<{
  __id: string;
  __typename: string;
  [field: string]: unknown;
}>;

export type RecordSource = Readonly<{
  [id: string]: StoreRecord | null;
}>;

export type EnvironmentSnapshot = Readonly<{
  envId: EnvironmentId;
  records: RecordSource;
  /** Monotonic counter, bumped on every store.publish. */
  version: number;
}>;

export type EnvironmentRegistered = Readonly<{
  type: 'environment.registered';
  envId: EnvironmentId;
}>;

export type StorePublish = Readonly<{
  type: 'store.publish';
  envId: EnvironmentId;
  version: number;
  records: RecordSource;
}>;

/**
 * Sent to the core (the page-side hook) when a devtools panel is now
 * watching the inspected tab. Cues the hook to start doing the
 * expensive sanitize+send work on every store.publish, and to replay
 * the current snapshot of every known env so the panel doesn't sit on
 * an empty state until the next publish fires.
 *
 * Only emitted by the Chrome-extension deploy, where the background
 * service worker synthesizes it on the content/panel port-pair
 * transitions. The standalone WS deploy has no equivalent and stays
 * always-connected.
 */
export type PanelConnected = Readonly<{
  type: 'panel.connected';
}>;

/**
 * The mirror of panel.connected: panel went away (closed, or its port
 * to the background was torn down). The hook suspends sanitize+send
 * until the next panel.connected.
 */
export type PanelGoodbye = Readonly<{
  type: 'panel.goodbye';
}>;

/** Messages flowing from the user's app → inspector UI. */
export type CoreToUi = EnvironmentRegistered | StorePublish;

/** Messages flowing from the inspector UI → user's app. */
export type UiToCore = PanelConnected | PanelGoodbye;

export type WireMessage = CoreToUi | UiToCore;
