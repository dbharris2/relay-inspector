import type { CoreToUi } from '~/shared/protocol';

/**
 * Envelope shared by main-world.ts and content.ts so they can pick
 * each other's window.postMessage out of all the other noise on the
 * shared message bus.
 */
export const ENVELOPE_TAG = '__relay_inspector__/v1';

export type Envelope = Readonly<{
  __relay_inspector__: typeof ENVELOPE_TAG;
  msg: CoreToUi;
}>;

export function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __relay_inspector__?: unknown }).__relay_inspector__ ===
      ENVELOPE_TAG
  );
}
