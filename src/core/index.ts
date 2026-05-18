/**
 * The "core" script — bundled into a small JS file that the user loads
 * into their app during development. Responsibilities:
 *
 *   1. Install the global hook (`window.__RELAY_INSPECTOR_HOOK__`).
 *   2. Detect Relay environments as they're created.
 *   3. Wrap `environment.__log` to capture `store.publish` events.
 *   4. Stream sanitized record snapshots back to the inspector UI
 *      over a WebSocket to localhost.
 *
 * Implementation is intentionally minimal here — this file is a stub
 * to be filled in next.
 */

export type ConnectOptions = {
  host?: string;
  port?: number;
};

export function connectToInspector(_options: ConnectOptions = {}): void {
  throw new Error('connectToInspector: not implemented yet');
}
