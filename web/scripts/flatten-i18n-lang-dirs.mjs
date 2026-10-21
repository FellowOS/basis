#!/usr/bin/env node
/**
 * Move i18n/{en,zh}/index.ts → i18n/{en,zh}.ts and remove empty locale dirs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function flattenRoot(i18nRoot) {
  if (!fs.existsSync(i18nRoot)) return 0;
  let n = 0;
  for (const lang of ['en', 'zh']) {
    const nested = path.join(i18nRoot, lang, 'index.ts');
    const flat = path.join(i18nRoot, `${lang}.ts`);
    if (!fs.existsSync(nested)) continue;
    if (fs.existsSync(flat)) {
      throw new Error(`already exists: ${flat}`);
    }
    fs.renameSync(nested, flat);
    const langDir = path.join(i18nRoot, lang);
    const left = fs.readdirSync(langDir);
    if (left.length > 0) {
      throw new Error(`non-empty ${langDir}: ${left.join(', ')}`);
    }
    fs.rmdirSync(langDir);
    n += 1;
  }
  return n;
}

let total = 0;
const roots = [
  path.join(srcRoot, 'i18n', 'core'),
  path.join(srcRoot, 'chrome', 'i18n'),
];
for (const mod of fs.readdirSync(path.join(srcRoot, 'modules'))) {
  roots.push(path.join(srcRoot, 'modules', mod, 'i18n'));
}

for (const root of roots) {
  const n = flattenRoot(root);
  if (n) console.log(`flattened ${path.relative(srcRoot, root)} (${n} files)`);
  total += n;
}

console.log(`done: ${total} locale files flattened`);
