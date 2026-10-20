import fs from 'node:fs';
import path from 'node:path';

import { isPackagedApp } from './paths.mjs';

/** @returns {Record<string, unknown> | null} */
export function loadPackagedApiManifest(resourcesPath) {
  const root = resourcesPath ?? (isPackagedApp() ? process.resourcesPath : null);
  if (!root) return null;
  const manifestPath = path.join(root, 'api-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function bundledBasisExecutable(resourcesPath, manifest) {
  const rel =
    manifest.basisRelative ??
    (process.platform === 'win32' ? 'sidecar/venv/Scripts/basis.exe' : 'sidecar/venv/bin/basis');
  return path.join(resourcesPath, rel);
}
