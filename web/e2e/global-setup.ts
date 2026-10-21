import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function globalSetup(): void {
  if (process.env.BASIS_E2E_KEEP_DATA === '1') {
    return;
  }
  // Playwright API data dirs (same cwd as `uv run basis` in playwright.config).
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  fs.rmSync(path.join(repoRoot, 'data', 'e2e'), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'data', 'e2e-desktop'), { recursive: true, force: true });
  // Legacy paths from before data/e2e migration.
  fs.rmSync(path.join(repoRoot, 'data-e2e'), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, 'data-e2e-desktop'), { recursive: true, force: true });
}
