import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function applyEnvFile(envFile: string): void {
  if (!fs.existsSync(envFile)) {
    return;
  }
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/** Load `web/.env*` into `process.env` (does not override existing vars). */
export function loadWebEnv(): void {
  applyEnvFile(path.join(WEB_ROOT, '.env'));
  applyEnvFile(path.join(WEB_ROOT, '.env.local'));
  applyEnvFile(path.join(WEB_ROOT, '.env.console.local'));
}
