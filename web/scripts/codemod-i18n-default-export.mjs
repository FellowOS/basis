#!/usr/bin/env node
// Rewrite export const <ns> = { to export default { in modules i18n en.ts / zh.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const modulesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/modules');
let n = 0;

for (const mod of fs.readdirSync(modulesRoot)) {
  for (const locale of ['en', 'zh']) {
    const file = path.join(modulesRoot, mod, 'i18n', `${locale}.ts`);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const next = text.replace(/^export const \w+ = /m, 'export default ');
    if (next !== text) {
      fs.writeFileSync(file, next);
      n += 1;
    }
  }
}

console.log(`default export: ${n} files`);
