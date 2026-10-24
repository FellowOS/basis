import path from 'node:path';

/** @param {string} venvDir */
export function venvBasisBin(venvDir) {
  return process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'basis.exe')
    : path.join(venvDir, 'bin', 'basis');
}

/** @param {string} venvDir */
export function venvPythonBin(venvDir) {
  return process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python3');
}

/** @param {string} venvDir */
export function venvScriptDir(venvDir) {
  return process.platform === 'win32' ? path.join(venvDir, 'Scripts') : path.join(venvDir, 'bin');
}

/** @param {string} sidecarRoot */
export function bundledCpythonRoot(sidecarRoot) {
  return path.join(sidecarRoot, 'runtime', 'cpython');
}

/** pyvenv.cfg `home` after packaging relocate */
export function bundledPyvenvHome(sidecarRoot) {
  const root = bundledCpythonRoot(sidecarRoot);
  return process.platform === 'win32' ? root : path.join(root, 'bin');
}

/** Must exist after stageSidecarPythonRuntime */
export function bundledRuntimeMarker(sidecarRoot) {
  const root = bundledCpythonRoot(sidecarRoot);
  return process.platform === 'win32' ? path.join(root, 'python.exe') : path.join(root, 'bin');
}

/** pyvenv.cfg `home` → source tree root to copy */
export function cpythonTreeFromPyvenvHome(homeFromCfg) {
  return process.platform === 'win32' ? homeFromCfg : path.dirname(homeFromCfg);
}
