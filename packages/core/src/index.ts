/**
 * Public API for programmatic use. Prefer the script-tag form for
 * simple dev setups; this entry exists for users who want to import
 * `relay-inspector/core` directly from their app.
 */
import { createConnection, type ConnectOptions } from './connect';
import { installHook } from './hook';

export type { ConnectOptions };

export function connectToInspector(options: ConnectOptions = {}): void {
  installHook(createConnection(options));
}
