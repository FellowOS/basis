/** DEPRECATED — workspace segments live under `web/src/modules/<segment>/`. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/kb');

function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function patchDir(dir) {
  const entries = fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
  const stems = new Set(entries.map((f) => f.replace(/\.(tsx?)$/, '').replace(/\.test$/, '')));

  for (const entry of entries) {
    const fp = path.join(dir, entry);
    let text = fs.readFileSync(fp, 'utf8');
    let changed = false;

    text = text.replace(
      /from\s+(['"])\.\/([^'"]+)\1/g,
      (full, quote, spec) => {
        const noExt = spec.replace(/\.js$/, '');
        if (stems.has(noExt)) return full;
        const kebab = toKebab(noExt);
        if (stems.has(kebab)) {
          changed = true;
          const ext = spec.endsWith('.js') ? '.js' : '';
          return `from ${quote}./${kebab}${ext}${quote}`;
        }
        return full;
      },
    );

    if (changed) fs.writeFileSync(fp, text);
  }
}

for (const seg of fs.readdirSync(kbRoot)) {
  const dir = path.join(kbRoot, seg);
  if (!fs.statSync(dir).isDirectory()) continue;
  patchDir(dir);
}

console.log('segment relative imports patched');
