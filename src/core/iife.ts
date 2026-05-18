/**
 * IIFE entry: installs the hook and opens a connection as soon as
 * the script is loaded. This is what gets bundled to `dist/core/core.js`
 * and served by the inspector's CLI server.
 *
 * Users load it via:
 *   <script src="http://localhost:8097/core.js"></script>
 * before their Relay app bundle.
 */
import { createConnection } from './connect';
import { installHook } from './hook';

// In a future iteration we might read host/port from a data-attribute
// on the script tag. Defaults are fine for now.
installHook(createConnection());
