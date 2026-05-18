#!/usr/bin/env node
/**
 * Entry point for `relay-inspector`. Boots the local server and opens
 * the inspector UI in the user's default browser.
 *
 * Shipping this as a real npm bin (so `npx relay-inspector` works
 * after install) needs a bundling step — deferred. For now run with:
 *
 *   pnpm start          # build + start
 *   pnpm dev:server     # dev mode (tsx watch)
 */
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import './src/server/index.ts';

const PORT = Number(process.env.PORT ?? 8097);
const url = `http://localhost:${PORT}/`;

function openInBrowser(target: string): void {
  const cmd =
    platform() === 'darwin'
      ? 'open'
      : platform() === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args =
    platform() === 'win32' ? ['/c', 'start', '""', target] : [target];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    console.log(`[relay-inspector] open ${target} in your browser`);
  }
}

// Give the server a beat to bind before opening the tab.
setTimeout(() => openInBrowser(url), 250);
