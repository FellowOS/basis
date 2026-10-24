import fs from 'node:fs';
import path from 'node:path';

import {
  bundledPyvenvHome,
  bundledRuntimeMarker,
  cpythonTreeFromPyvenvHome,
  venvPythonBin,
  venvScriptDir,
} from './python-layout.mjs';

function readPyvenvHomeBin(venvDir) {
  const cfgPath = path.join(venvDir, 'pyvenv.cfg');
  const cfg = fs.readFileSync(cfgPath, 'utf8');
  const m = cfg.match(/^home\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error(`[relocate-venv] missing home in ${cfgPath}`);
  return m[1].trim();
}

function writePyvenvHome(venvDir, homeBin) {
  const cfgPath = path.join(venvDir, 'pyvenv.cfg');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  if (/^home\s*=/m.test(cfg)) {
    cfg = cfg.replace(/^home\s*=.*/m, `home = ${homeBin}`);
  } else {
    cfg = `home = ${homeBin}\n${cfg}`;
  }
  fs.writeFileSync(cfgPath, cfg, 'utf8');
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, dereference: true, errorOnExist: false });
}

/**
 * Copy uv-managed CPython tree next to the venv (once, at stage time).
 */
export function stageSidecarPythonRuntime(venvDir, sidecarRoot) {
  const homeFromCfg = readPyvenvHomeBin(venvDir);
  const cpythonRoot = cpythonTreeFromPyvenvHome(homeFromCfg);
  const destRoot = path.join(sidecarRoot, 'runtime', 'cpython');
  if (fs.existsSync(destRoot)) return destRoot;
  console.log('[stage-api] Copying CPython runtime into sidecar…');
  copyDir(cpythonRoot, destRoot);
  return destRoot;
}

/**
 * Fix pyvenv.cfg + console script shebangs for the final on-disk layout (.app Resources).
 */
export function relocatePackagedVenv(venvDir) {
  const sidecarRoot = path.dirname(venvDir);
  const runtimeHome = bundledPyvenvHome(sidecarRoot);
  const marker = bundledRuntimeMarker(sidecarRoot);
  if (!fs.existsSync(marker)) {
    throw new Error(`[relocate-venv] missing ${marker} — rebuild with --bundle-venv`);
  }
  const venvPython = venvPythonBin(venvDir);
  if (!fs.existsSync(venvPython)) {
    throw new Error(`[relocate-venv] missing ${venvPython}`);
  }

  writePyvenvHome(venvDir, runtimeHome);

  if (process.platform === 'win32') {
    return;
  }

  const binDir = venvScriptDir(venvDir);
  for (const name of fs.readdirSync(binDir)) {
    const file = path.join(binDir, name);
    if (!fs.statSync(file).isFile()) continue;
    const buf = fs.readFileSync(file, 'utf8');
    if (!buf.startsWith('#!')) continue;
    const nl = buf.indexOf('\n');
    const first = buf.slice(0, nl);
    if (!first.includes('python')) continue;
    const rest = buf.slice(nl + 1);
    fs.writeFileSync(file, `#!${venvPython}\n${rest}`, 'utf8');
  }
}
