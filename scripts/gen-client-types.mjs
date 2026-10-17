#!/usr/bin/env node
/**
 * Regenerate @basis/client TypeScript types from the KB OpenAPI slice.
 *
 * Usage: node scripts/gen-client-types.mjs
 * Requires: npm install in packages/client (openapi-typescript).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = path.join(repoRoot, 'packages', 'client');
const spec = path.join(repoRoot, 'openapi', 'basis-v1-kb.yaml');
const out = path.join(clientDir, 'src', 'schema.d.ts');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'gen:types'], {
  cwd: clientDir,
  stdio: 'inherit',
  env: { ...process.env, BASIS_OPENAPI_KB: spec, BASIS_CLIENT_TYPES_OUT: out },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${out} from ${spec}`);
