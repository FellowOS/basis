import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Dev monorepo root (`basis/`). */
export const DEV_REPO_ROOT = path.resolve(__dirname, '../..');

function electronApp() {
  if (!process.versions.electron) return null;
  try {
    return require('electron').app;
  } catch {
    return null;
  }
}

export function isPackagedApp() {
  if (process.env.BASIS_DESKTOP_PACKAGED === '1') return true;
  const app = electronApp();
  return app?.isPackaged === true;
}

/** Python monorepo root (``uv run basis`` cwd). Packaged builds embed path at dist time. */
export function resolveRepoRoot() {
  if (process.env.BASIS_REPO_ROOT?.trim()) {
    return path.resolve(process.env.BASIS_REPO_ROOT.trim());
  }
  if (!isPackagedApp()) {
    return DEV_REPO_ROOT;
  }
  const manifestPath = path.join(process.resourcesPath, 'api-manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest?.kind === 'bundled-venv') {
      return process.resourcesPath;
    }
  }
  const marker = path.join(process.resourcesPath, 'monorepo-root.json');
  if (fs.existsSync(marker)) {
    const data = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (data?.root && fs.existsSync(data.root)) {
      return path.resolve(data.root);
    }
  }
  throw new Error(
    'Packaged Basis Desktop needs BASIS_REPO_ROOT or a valid monorepo-root.json (rebuild dist from this checkout).',
  );
}

export function packagedWebDir() {
  if (!isPackagedApp()) return null;
  return path.join(process.resourcesPath, 'web');
}

export function packagedProfilePath() {
  if (!isPackagedApp()) return null;
  const p = path.join(process.resourcesPath, 'profiles', 'profile.desktop.yaml');
  return fs.existsSync(p) ? p : null;
}
