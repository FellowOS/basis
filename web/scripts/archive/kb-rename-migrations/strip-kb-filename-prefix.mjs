/** DEPRECATED — legacy chrome is under `chrome/`; modules use unprefixed role filenames. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(webRoot, 'src');
const e2e = path.join(webRoot, 'e2e');

const moves = [];

function planRename(from, to) {
  if (!fs.existsSync(from)) return;
  if (fs.existsSync(to) && path.resolve(from) !== path.resolve(to)) {
    throw new Error(`exists: ${to}`);
  }
  moves.push([from, to]);
}

// lib/kb-* → lib/kb/*
const libDir = path.join(src, 'lib');
const kbPkg = path.join(libDir, 'kb');
fs.mkdirSync(kbPkg, { recursive: true });

for (const name of fs.readdirSync(libDir)) {
  if (name.startsWith('kb-') && /\.(tsx?|mjs)$/.test(name)) {
    planRename(path.join(libDir, name), path.join(kbPkg, name.slice(3)));
  }
  if (name.startsWith('use-kb-') && name.endsWith('.ts')) {
    planRename(path.join(libDir, name), path.join(kbPkg, `use-${name.slice('use-kb-'.length)}`));
  }
}

// components/app/kb/**/kb-*
function walkKbComponents(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkKbComponents(p);
    else if (name.startsWith('kb-') && /\.tsx?$/.test(name)) {
      planRename(p, path.join(dir, name.slice(3)));
    }
  }
}
walkKbComponents(path.join(src, 'components/app/kb'));

// e2e
const e2eSpec = path.join(e2e, 'kb-settings-tabs.spec.ts');
if (fs.existsSync(e2eSpec)) {
  planRename(e2eSpec, path.join(e2e, 'settings-tabs.spec.ts'));
}

for (const [from, to] of moves) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

const textRoots = [src, e2e, path.join(webRoot, '..', 'docs'), path.join(webRoot, '..', 'AGENTS.md')];
const files = [];

function walkText(dir) {
  if (!fs.existsSync(dir)) return;
  if (fs.statSync(dir).isFile()) {
    files.push(dir);
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'kb-explorer') continue;
    walkText(path.join(dir, name));
  }
}
walkText(src);
walkText(e2e);
walkText(path.join(webRoot, '..', 'docs'));
if (fs.existsSync(path.join(webRoot, '..', 'AGENTS.md'))) {
  files.push(path.join(webRoot, '..', 'AGENTS.md'));
}

for (const fp of files) {
  if (!/\.(tsx?|md|mjs|json)$/.test(fp)) continue;
  let text = fs.readFileSync(fp, 'utf8');
  let next = text;
  next = next.replace(/@\/lib\/kb-([a-z0-9-]+)/g, '@/lib/kb/$1');
  next = next.replace(/@\/lib\/use-kb-([a-z0-9-]+)/g, '@/lib/kb/use-$1');
  next = next.replace(
    /@\/components\/app\/kb\/((?:widgets|ws-shell|dialogs)\/)kb-/g,
    '@/components/app/kb/$1',
  );
  // playwright config / readme
  next = next.replace(/e2e\/kb-settings-tabs\.spec/g, 'e2e/settings-tabs.spec');
  if (next !== text) fs.writeFileSync(fp, next);
}

console.log(`Renamed ${moves.length} files; updated imports.`);
