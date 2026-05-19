import type { CoreToUi, UiToCore } from '~/shared/protocol';

/**
 * window.postMessage envelopes shared by main-world.ts and content.ts
 * so they can pick each other's traffic out of all the other noise on
 * the shared message bus. Two tags so a listener for one direction
 * doesn't see (or echo) messages in the other direction.
 */

export const UPSTREAM_TAG = '__relay_inspector_up__/v1';
export const DOWNSTREAM_TAG = '__relay_inspector_down__/v1';

export type UpstreamEnvelope = Readonly<{
  __relay_inspector_up__: typeof UPSTREAM_TAG;
  msg: CoreToUi;
}>;

export type DownstreamEnvelope = Readonly<{
  __relay_inspector_down__: typeof DOWNSTREAM_TAG;
  msg: UiToCore;
}>;

export function isUpstreamEnvelope(value: unknown): value is UpstreamEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __relay_inspector_up__?: unknown }).__relay_inspector_up__ ===
      UPSTREAM_TAG
  );
}

export function isDownstreamEnvelope(
  value: unknown,
): value is DownstreamEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __relay_inspector_down__?: unknown })
      .__relay_inspector_down__ === DOWNSTREAM_TAG
  );
}
