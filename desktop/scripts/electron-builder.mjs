#!/usr/bin/env node
/**
 * electron-builder wrapper (Fellow packages/desktop/scripts/electron-builder.mjs).
 *
 *   BASIS_DIST_UNSIGNED=1  — skip code signing (mac identity=null; win unsigned)
 *   --dir-only             — mac: unpacked .app only (fast smoke; not for release)
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { desktopRoot } from './paths.mjs';

const builderCli = path.join(desktopRoot, 'node_modules', 'electron-builder', 'cli.js');

const argv = process.argv.slice(2);
const wantDirOnly = argv.includes('--dir-only');
const wantMac = argv.includes('--mac') || wantDirOnly;
const wantWin = argv.includes('--win');
const wantLinux = argv.includes('--linux');

const builderArgs = ['--config', 'electron-builder.config.cjs'];

if (wantMac) builderArgs.unshift('--mac');
else if (wantWin) builderArgs.unshift('--win');
else if (wantLinux) builderArgs.unshift('--linux');
else builderArgs.unshift('--dir');

if (wantDirOnly) {
  builderArgs.push('--config.mac.target=dir');
}

const unsigned =
  process.env.BASIS_DIST_UNSIGNED === '1' ||
  ['1', 'true', 'yes'].includes(process.env.BASIS_DIST_UNSIGNED?.trim().toLowerCase() ?? '');

if (unsigned && wantMac) {
  builderArgs.push('-c.mac.identity=null', '-c.mac.sign.identity=null');
}
if (unsigned && wantWin) {
  // signExecutable=false + CSC_IDENTITY_AUTO_DISCOVERY=false; avoid -c.win.sign=null (invalid schema in eb 26)
  builderArgs.push('-c.win.signExecutable=false');
}

const env = unsigned
  ? { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
  : process.env;

if (unsigned && wantMac) {
  console.log('[electron-builder] unsigned mac pack (identity=null)');
}
if (unsigned && wantWin) {
  console.log('[electron-builder] unsigned win pack (signing disabled)');
}

console.log('[electron-builder]', builderArgs.join(' '));
execFileSync(process.execPath, [builderCli, ...builderArgs], {
  cwd: desktopRoot,
  stdio: 'inherit',
  env,
});

console.log('[electron-builder] Done → desktop/release/');
