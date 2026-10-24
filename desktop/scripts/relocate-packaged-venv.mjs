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
 * Replace symlink entries with real files/dirs (7-Zip on Windows chokes on python3.exe links).
 */
export function materializeCopiedTree(root) {
  if (!fs.existsSync(root)) return;
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    const lst = fs.lstatSync(full);
    if (!lst.isSymbolicLink()) {
      if (lst.isDirectory()) materializeCopiedTree(full);
      continue;
    }
    const target = fs.readlinkSync(full);
    const resolved = path.resolve(path.dirname(full), target);
    fs.rmSync(full, { recursive: true, force: true });
    if (!fs.existsSync(resolved)) continue;
    const rstat = fs.statSync(resolved);
    if (rstat.isDirectory()) {
      fs.cpSync(resolved, full, { recursive: true, dereference: true });
      materializeCopiedTree(full);
    } else {
      fs.copyFileSync(resolved, full);
    }
  }
}

/** @param {string} dir Directory that may contain python.exe / python3.exe */
export function normalizeWindowsPython3Launcher(dir) {
  const py = path.join(dir, 'python.exe');
  const py3 = path.join(dir, 'python3.exe');
  if (!fs.existsSync(py3)) return;
  const lst = fs.lstatSync(py3);
  if (lst.isFile() && !lst.isSymbolicLink()) return;
  fs.rmSync(py3, { recursive: true, force: true });
  if (fs.existsSync(py)) {
    fs.copyFileSync(py, py3);
  }
}

/** Materialize uv CPython + venv Scripts so electron-builder 7z can pack the sidecar. */
export function finalizeWindowsBundledSidecar(sidecarRoot) {
  if (process.platform !== 'win32') return;
  const cpython = path.join(sidecarRoot, 'runtime', 'cpython');
  if (fs.existsSync(cpython)) {
    materializeCopiedTree(cpython);
    normalizeWindowsPython3Launcher(cpython);
  }
  const scripts = path.join(sidecarRoot, 'venv', 'Scripts');
  if (fs.existsSync(scripts)) {
    materializeCopiedTree(scripts);
    normalizeWindowsPython3Launcher(scripts);
  }
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
  finalizeWindowsBundledSidecar(sidecarRoot);
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
    finalizeWindowsBundledSidecar(sidecarRoot);
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
