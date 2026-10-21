#!/usr/bin/env node
// Apply scripts/i18n-path-map.json: t.old -> t.new across web/src
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(webRoot, 'src');
const mapPath = path.join(webRoot, 'scripts/i18n-path-map.json');

const pathMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const extras = {
  common: 'core.common',
  apiErrorCodes: 'core.api_error_codes',
  dev: 'core.dev',
  sidebar: 'chrome.sidebar',
  nav: 'chrome.nav',
  menu: 'chrome.menu',
  pages: null,
};

const replacements = Object.entries(pathMap).map(([oldP, newP]) => ({
  from: `t.${oldP}`,
  to: `t.${newP}`,
}));

for (const [oldTop, newTop] of Object.entries(extras)) {
  if (!newTop) continue;
  replacements.push({ from: `t.${oldTop}.`, to: `t.${newTop}.` });
  replacements.push({ from: `t.${oldTop}`, to: `t.${newTop}` });
}

replacements.sort((a, b) => b.from.length - a.from.length);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name === 'dist') continue;
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/\.(tsx?)$/.test(name)) files.push(full);
  }
  return files;
}

let fileCount = 0;
let replaceCount = 0;

for (const file of walk(srcRoot)) {
  if (file.includes('/i18n/locales/') || file.includes('/i18n/core/')) continue;
  if (file.includes('/modules/') && file.includes('/i18n/')) continue;
  if (file.includes('/chrome/i18n/')) continue;
  let text = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const { from, to } of replacements) {
    if (!text.includes(from)) continue;
    const next = text.split(from).join(to);
    if (next !== text) {
      text = next;
      changed = true;
      replaceCount += 1;
    }
  }
  if (changed) {
    fs.writeFileSync(file, text);
    fileCount += 1;
  }
}

console.log(`Updated ${fileCount} files (${replaceCount} replacement passes).`);
