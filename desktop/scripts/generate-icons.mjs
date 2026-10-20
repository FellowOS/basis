import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pngToIco from 'png-to-ico';
import sharp from 'sharp';

import { renderSidebarOrbPng } from './render-sidebar-orb.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.join(scriptDir, '..');
const buildDir = path.join(desktopDir, 'build');

async function pngAt(masterPng, size) {
  return sharp(masterPng).resize(size, size).png().toBuffer();
}

async function writeIco(masterPng) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(sizes.map((s) => pngAt(masterPng, s)));
  const ico = await pngToIco(buffers);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
}

async function writeMacIcns(masterPng) {
  const iconset = path.join(buildDir, 'icon.iconset');
  fs.rmSync(iconset, { recursive: true, force: true });
  fs.mkdirSync(iconset, { recursive: true });

  const pairs = [
    [16, '16x16'],
    [32, '16x16@2x'],
    [32, '32x32'],
    [64, '32x32@2x'],
    [128, '128x128'],
    [256, '128x128@2x'],
    [256, '256x256'],
    [512, '256x256@2x'],
    [512, '512x512'],
    [1024, '512x512@2x'],
  ];

  for (const [size, name] of pairs) {
    const buf = await pngAt(masterPng, size);
    fs.writeFileSync(path.join(iconset, `icon_${name}.png`), buf);
  }

  const icnsPath = path.join(buildDir, 'icon.icns');
  execSync(`iconutil -c icns "${iconset}" -o "${icnsPath}"`, { stdio: 'inherit' });
  fs.rmSync(iconset, { recursive: true, force: true });
}

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });

  const masterPng = renderSidebarOrbPng(1024, 'light');
  fs.writeFileSync(path.join(buildDir, 'icon.png'), masterPng);
  await writeIco(masterPng);

  if (process.platform === 'darwin') {
    await writeMacIcns(masterPng);
  } else {
    console.warn('[icons] Skipping icon.icns (requires macOS iconutil). Commit build/icon.icns or run on macOS.');
  }

  console.log(
    '[icons] Sidebar AppLogo (working, 20px, light) → build/icon.png, build/icon.ico' +
      (process.platform === 'darwin' ? ', build/icon.icns' : ''),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
