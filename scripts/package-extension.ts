#!/usr/bin/env -S tsx
/**
 * Builds the Chrome extension and zips it for Chrome Web Store
 * submission.
 *
 * Output: relay-inspector-vX.Y.Z.zip at the repo root, where X.Y.Z
 * is whatever's in package.json. The zip wraps `dist/extension/`'s
 * contents (i.e. the manifest is at the zip root, not nested under
 * an `extension/` directory — that's what the Web Store expects).
 *
 * Run via `pnpm package:extension`.
 */
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../..');

const pkg = JSON.parse(
  readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'),
) as { version: string };

const zipName = `relay-inspector-v${pkg.version}.zip`;
const zipPath = resolve(repoRoot, zipName);

console.log(`Building extension v${pkg.version}…`);
execSync('pnpm build:extension', { stdio: 'inherit', cwd: repoRoot });

try {
  rmSync(zipPath, { force: true });
} catch {
  /* fine */
}

console.log(`\nZipping dist/extension → ${zipName}…`);
// Run zip from inside dist/extension so the manifest lives at the
// zip's root, not nested. Web Store rejects nested-directory zips.
execSync(`zip -r ${JSON.stringify(zipPath)} .`, {
  stdio: 'inherit',
  cwd: resolve(repoRoot, 'dist', 'extension'),
});

console.log(`\n✓ ${zipName} ready to upload.`);
console.log(
  '  Submit at https://chrome.google.com/webstore/devconsole — drag the zip into the new-item form.',
);
