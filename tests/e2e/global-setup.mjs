import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wipe Playwright data dirs. Must run before the E2E API process starts (not in Playwright globalSetup). */
export function wipeE2eDataDirs() {
  if (process.env.BASIS_E2E_KEEP_DATA === '1') {
    return;
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const e2eData = path.join(repoRoot, 'data', 'e2e');
  fs.rmSync(path.join(e2eData, 'playwright-admin.json'), { force: true });
  fs.rmSync(e2eData, { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'data', 'e2e-desktop'), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'data-e2e'), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'data-e2e-desktop'), { recursive: true, force: true });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  wipeE2eDataDirs();
}
