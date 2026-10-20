import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {{ webDistDir: string; profilesDir: string; apiStageDir: string }} roots
 * @returns {string[]} error messages (empty = OK)
 */
export function collectReleaseResourceErrors({ webDistDir, profilesDir, apiStageDir }) {
  const errors = [];

  function missing(label, filePath) {
    if (!fs.existsSync(filePath)) {
      errors.push(`missing ${label}: ${filePath}`);
    }
  }

  missing('web build', path.join(webDistDir, 'index.html'));
  missing('desktop profile', path.join(profilesDir, 'profile.desktop.yaml'));

  const manifestPath = path.join(apiStageDir, 'api-manifest.json');
  missing('api manifest', manifestPath);
  if (!fs.existsSync(manifestPath)) {
    return errors;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    errors.push(`invalid api manifest JSON: ${err instanceof Error ? err.message : String(err)}`);
    return errors;
  }

  if (manifest.kind === 'bundled-venv') {
    const basisBin =
      process.platform === 'win32'
        ? path.join(apiStageDir, 'sidecar', 'venv', 'Scripts', 'basis.exe')
        : path.join(apiStageDir, 'sidecar', 'venv', 'bin', 'basis');
    missing('bundled basis CLI', basisBin);
    missing(
      'bundled CPython runtime',
      path.join(apiStageDir, 'sidecar', 'runtime', 'cpython', 'bin'),
    );
  } else if (manifest.kind === 'uv-monorepo') {
    missing('monorepo-root.json', path.join(apiStageDir, 'monorepo-root.json'));
  } else {
    errors.push(`unknown api-manifest kind: ${manifest.kind}`);
  }

  return errors;
}

/**
 * @param {{ webDistDir: string; profilesDir: string; apiStageDir: string }} roots
 */
export function verifyReleaseResources(roots) {
  const errors = collectReleaseResourceErrors(roots);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}
