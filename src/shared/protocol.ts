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
 * Sent by the inspector UI when it first connects so the core can
 * replay environment.registered + store.publish for any envs that
 * registered before the UI was listening — most commonly the case
 * when DevTools is opened on a page that was already loaded.
 */
export type PanelHello = Readonly<{
  type: 'panel.hello';
}>;

/** Messages flowing from the user's app → inspector UI. */
export type CoreToUi = EnvironmentRegistered | StorePublish;

/** Messages flowing from the inspector UI → user's app. */
export type UiToCore = PanelHello;

export type WireMessage = CoreToUi | UiToCore;
