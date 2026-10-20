#!/usr/bin/env node
/**
 * Ensure a complete Electron binary (npm allowScripts / extract-zip on Node 26 can leave a stub dist/).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const electronDir = path.join(desktopRoot, 'node_modules', 'electron');

function platformRelPath() {
  if (process.platform === 'darwin') return 'Electron.app/Contents/MacOS/Electron';
  if (process.platform === 'win32') return 'electron.exe';
  return 'electron';
}

function electronBinary() {
  return path.join(electronDir, 'dist', platformRelPath());
}

function isDistComplete() {
  const bin = electronBinary();
  if (!fs.existsSync(bin)) return false;

  if (process.platform === 'darwin') {
    const framework = path.join(
      electronDir,
      'dist',
      'Electron.app/Contents/Frameworks/Electron Framework.framework/Electron Framework',
    );
    return fs.existsSync(framework);
  }

  try {
    return fs.statSync(bin).size > 50_000_000;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`[ensure-electron] ${message}`);
  process.exit(1);
}

function resolveArch() {
  let arch = process.arch;
  if (
    process.platform === 'darwin' &&
    arch === 'x64' &&
    process.env.npm_config_arch === undefined
  ) {
    try {
      const out = spawnSync('sysctl', ['-in', 'sysctl.proc_translated'], { encoding: 'utf8' });
      if (out.stdout?.trim() === '1') arch = 'arm64';
    } catch {
      // ignore
    }
  }
  return arch;
}

async function downloadAndExtract() {
  const { downloadArtifact } = await import('@electron/get');
  const { version } = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'));
  const distDir = path.join(electronDir, 'dist');

  console.log(`[ensure-electron] Downloading Electron ${version} (${process.platform}-${resolveArch()})…`);
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: resolveArch(),
    force: true,
  });

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  if (process.platform === 'win32') {
    const extract = require('extract-zip');
    await extract(zipPath, { dir: path.resolve(distDir) });
  } else {
    const unzip = spawnSync('unzip', ['-q', zipPath, '-d', distDir], { stdio: 'inherit' });
    if (unzip.status !== 0) {
      fail('unzip failed — install unzip or fix Electron cache');
    }
  }

  const rel = platformRelPath();
  fs.writeFileSync(path.join(electronDir, 'path.txt'), rel, 'utf8');
}

async function main() {
  if (!fs.existsSync(path.join(electronDir, 'package.json'))) {
    fail('Run `npm install` in desktop/ first.');
  }

  if (!isDistComplete()) {
    await downloadAndExtract();
  }

  if (!isDistComplete()) {
    fail('Electron dist still incomplete after download.');
  }

  console.log('[ensure-electron] OK', electronBinary());
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
