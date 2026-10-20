import fs from 'node:fs';
import path from 'node:path';

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
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

/**
 * Copy uv-managed CPython tree next to the venv (once, at stage time).
 */
export function stageSidecarPythonRuntime(venvDir, sidecarRoot) {
  const homeBin = readPyvenvHomeBin(venvDir);
  const cpythonRoot = path.dirname(homeBin);
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
  const runtimeBin = path.join(sidecarRoot, 'runtime', 'cpython', 'bin');
  if (!fs.existsSync(runtimeBin)) {
    throw new Error(`[relocate-venv] missing ${runtimeBin} — rebuild with --bundle-venv`);
  }
  const venvPython = path.join(venvDir, 'bin', 'python3');
  if (!fs.existsSync(venvPython)) {
    throw new Error(`[relocate-venv] missing ${venvPython}`);
  }

  writePyvenvHome(venvDir, runtimeBin);

  const binDir = path.join(venvDir, 'bin');
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
