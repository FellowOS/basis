#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const modulesRoot = path.join(webSrc, 'modules');
const SUBS = ['pages', 'i18n', 'components', 'hooks', 'lib'];

/** @type {Map<string, string>} moduleName -> Map<fileBase, subdir/fileBase.js> */
const byModule = new Map();

for (const mod of fs.readdirSync(modulesRoot)) {
  const modPath = path.join(modulesRoot, mod);
  if (!fs.statSync(modPath).isDirectory()) continue;
  const files = new Map();
  for (const sub of SUBS) {
    const subPath = path.join(modPath, sub);
    if (!fs.existsSync(subPath)) continue;
    for (const file of fs.readdirSync(subPath)) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      const base = file.replace(/\.(tsx?|jsx?)$/, '');
      files.set(base, `${sub}/${base}.js`);
    }
  }
  byModule.set(mod, files);
}

function moduleFromFile(filePath) {
  const rel = path.relative(modulesRoot, filePath);
  const mod = rel.split(path.sep)[0];
  if (!byModule.has(mod)) return null;
  return mod;
}

function patchFile(filePath) {
  const mod = moduleFromFile(filePath);
  if (!mod) return;
  const fileMap = byModule.get(mod);
  const fileDir = path.dirname(filePath);
  const modPath = path.join(modulesRoot, mod);

  let text = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  text = text.replace(
    /from\s+['"](\.[^'"]+)['"]/g,
    (match, relImport) => {
      if (!relImport.startsWith('.')) return match;
      const abs = path.normalize(path.join(fileDir, relImport));
      const base = path.basename(abs);
      const mapped = fileMap.get(base);
      if (!mapped) return match;
      const targetAbs = path.join(modPath, mapped.replace(/\.js$/, ''));
      let rel = path.relative(fileDir, targetAbs).replace(/\\/g, '/');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      const newImport = `${rel}.js`;
      if (newImport === `${relImport}.js` || newImport === relImport) return match;
      changed = true;
      return `from '${newImport}'`;
    },
  );

  if (changed) fs.writeFileSync(filePath, text);
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (/\.(tsx?)$/.test(name)) patchFile(full);
  }
}

walk(modulesRoot);
console.log('Patched relative imports under modules/');
