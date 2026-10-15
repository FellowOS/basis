import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function globalSetup(): void {
  if (!process.env.CI) {
    return;
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.rmSync(path.join(repoRoot, 'data-e2e'), { recursive: true, force: true });
}
