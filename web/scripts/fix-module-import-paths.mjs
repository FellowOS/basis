#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const modulesRoot = path.join(webSrc, 'modules');

/** @type {Map<string, string>} key: `module/file` (no ext) -> subpath like `index` or `pages/screen` */
const index = new Map();

function walkFiles(dir, rel = '') {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    if (fs.statSync(full).isDirectory()) {
      if (['pages', 'i18n', 'components', 'hooks', 'lib'].includes(name) && rel === '') {
        walkFiles(full, name);
      }
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(name)) continue;
    const mod = path.basename(dir, path.extname(dir)) === name
      ? path.basename(path.dirname(dir))
      : null;
    // rel is like pages/page.tsx
    const parts = relPath.replace(/\.(tsx?|jsx?)$/, '').split('/');
    const moduleName = path.relative(modulesRoot, dir).split(path.sep)[0];
    if (!['pages', 'i18n', 'components', 'hooks', 'lib'].includes(parts[0])) continue;
    const fileBase = parts.slice(1).join('/') || parts[0];
    const key = `${moduleName}/${fileBase}`;
    index.set(key, relPath.replace(/\.(tsx?)$/, '.js').replace(/\.jsx$/, '.js'));
  }
}

for (const mod of fs.readdirSync(modulesRoot)) {
  const modPath = path.join(modulesRoot, mod);
  if (!fs.statSync(modPath).isDirectory() || mod === 'README.md') continue;
  const routeIndex = path.join(modPath, 'index.tsx');
  if (fs.existsSync(routeIndex)) {
    index.set(`${mod}/page`, 'index.js');
    index.set(`${mod}/index`, 'index.js');
  }
  for (const sub of ['pages', 'i18n', 'components', 'hooks', 'lib']) {
    const subPath = path.join(modPath, sub);
    if (!fs.existsSync(subPath)) continue;
    for (const file of fs.readdirSync(subPath)) {
      if (!/\.(tsx?|jsx?)$/.test(file)) continue;
      const base = file.replace(/\.(tsx?|jsx?)$/, '');
      const key = `${mod}/${base}`;
      const mapped = `${sub}/${base}.js`;
      index.set(key, mapped);
    }
  }
}

function resolveModuleImport(mod, filePath) {
  const withoutExt = filePath.replace(/\.js$/, '');
  const key = `${mod}/${withoutExt}`;
  if (index.has(key)) return `@/modules/${mod}/${index.get(key)}`;
  return null;
}

function patchFile(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  text = text.replace(
    /@\/modules\/([a-z0-9-]+)\/([a-zA-Z0-9_./-]+)\.js/g,
    (match, mod, rest) => {
      if (rest.startsWith('pages/') || rest.startsWith('components/') || rest.startsWith('lib/') || rest.startsWith('i18n/') || rest.startsWith('hooks/')) {
        return match;
      }
      const fixed = resolveModuleImport(mod, rest);
      if (fixed) {
        changed = true;
        return fixed;
      }
      return match;
    },
  );

  if (changed) fs.writeFileSync(filePath, text);
}

function walkSrc(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '.source') continue;
      walkSrc(full);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(name)) patchFile(full);
  }
}

walkSrc(webSrc);
console.log(`Indexed ${index.size} module paths; patched @/modules imports.`);
