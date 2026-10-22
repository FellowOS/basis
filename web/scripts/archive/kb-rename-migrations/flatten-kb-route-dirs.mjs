/**
 * DEPRECATED — workspace routes now live under web/src/modules/<segment>/.
 * Historical one-off: flattened pages/kb/<segment>/screen/** into segment root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const kbRoot = path.join(repoRoot, 'web/src/pages/kb');

function toKebab(stem) {
  const test = stem.endsWith('.test');
  const base = test ? stem.slice(0, -5) : stem;
  const kebab = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  return test ? `${kebab}.test` : kebab;
}

function destFileName(relParts, fileName) {
  const ext = path.extname(fileName);
  let stem = path.basename(fileName, ext);
  if (stem.endsWith('.test')) {
    const base = stem.slice(0, -5);
    stem = `${toKebab(base)}.test`;
  } else {
    stem = toKebab(stem);
  }

  if (relParts.length === 0) {
    return `${stem}${ext}`;
  }

  const folder = relParts[0];
  if (folder === 'behaviors') return `behavior-${stem}${ext}`;
  if (folder === 'plugins') return `plugin-${stem}${ext}`;
  if (folder === 'sparql') {
    return stem.startsWith('sparql-') ? `${stem}${ext}` : `sparql-${stem}${ext}`;
  }
  if (folder === 'reasoning') {
    return stem.startsWith('reasoning-') ? `${stem}${ext}` : `reasoning-${stem}${ext}`;
  }
  const prefix = relParts.map((p) => toKebab(p)).join('-');
  return `${prefix}-${stem}${ext}`;
}

/** @type {Map<string, string>} old abs -> new abs */
const moveMap = new Map();

function collectScreenFiles(segmentDir) {
  const screen = path.join(segmentDir, 'screen');
  if (!fs.existsSync(screen)) return;

  for (const entry of walk(screen)) {
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    const relFromScreen = path.relative(screen, entry);
    const relParts = path.dirname(relFromScreen).split(path.sep).filter((p) => p !== '.');
    const base = path.basename(entry);
    const destName = destFileName(relParts, base);
    const dest = path.join(segmentDir, destName);
    if (fs.existsSync(dest) && path.resolve(dest) !== path.resolve(entry)) {
      throw new Error(`Collision: ${dest} already exists (${entry})`);
    }
    moveMap.set(path.resolve(entry), path.resolve(dest));
  }
}

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

for (const name of fs.readdirSync(kbRoot)) {
  const segmentDir = path.join(kbRoot, name);
  if (!fs.statSync(segmentDir).isDirectory()) continue;
  if (name === 'kb') continue;
  collectScreenFiles(segmentDir);
}

// Apply moves (deepest first)
const moves = [...moveMap.entries()].sort((a, b) => b[0].length - a[0].length);
for (const [from, to] of moves) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

// Remove empty screen trees
for (const name of fs.readdirSync(kbRoot)) {
  const screen = path.join(kbRoot, name, 'screen');
  if (fs.existsSync(screen)) {
    fs.rmSync(screen, { recursive: true, force: true });
  }
}

/** Build replacement rules for import paths */
const importReplacements = [];

for (const [from, to] of moveMap.entries()) {
  const seg = path.relative(kbRoot, from).split(path.sep)[0];
  const oldRel = path.relative(path.join(kbRoot, seg), from).split(path.sep).join('/');
  const newRel = path.relative(path.join(kbRoot, seg), to).split(path.sep).join('/');
  const oldBase = oldRel.replace(/\.(tsx?)$/, '');
  const newBase = newRel.replace(/\.(tsx?)$/, '');

  importReplacements.push({
    seg,
    oldAbs: `@/pages/kb/${seg}/${oldRel.replace(/\.tsx?$/, '')}`,
    newAbs: `@/pages/kb/${seg}/${newBase}`,
    oldDot: `./${oldRel.replace(/\.tsx?$/, '')}`,
    newDot: `./${newBase}`,
    oldDotNoExt: oldBase,
    newDotNoExt: newBase,
  });
}

// Also global /screen/ in absolute kb imports
const webSrc = path.join(repoRoot, 'web');
const files = [];
function walkWeb(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walkWeb(p);
    } else if (/\.(tsx?|md|mjs)$/.test(name)) {
      files.push(p);
    }
  }
}
walkWeb(webSrc);
if (fs.existsSync(path.join(repoRoot, 'AGENTS.md'))) {
  files.push(path.join(repoRoot, 'AGENTS.md'));
}
const docsDir = path.join(repoRoot, 'docs');
if (fs.existsSync(docsDir)) walkWeb(docsDir);

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  let changed = false;

  for (const r of importReplacements) {
    if (!file.includes(path.join('pages', 'kb', r.seg))) {
      // still apply absolute imports from anywhere
    }
    const patterns = [
      [r.oldAbs, r.newAbs],
      [r.oldAbs + '.js', r.newAbs + '.js'],
      [r.oldDot, r.newDot],
      [r.oldDot + '.js', r.newDot + '.js'],
    ];
    for (const [a, b] of patterns) {
      if (text.includes(a)) {
        text = text.split(a).join(b);
        changed = true;
      }
    }
  }

  // Fallback: strip /screen/ segment in kb paths
  const fallback = text.replace(/(@\/pages\/kb\/[^/'"]+)\/screen\//g, '$1/');
  if (fallback !== text) {
    text = fallback;
    changed = true;
  }

  if (changed) fs.writeFileSync(file, text);
}

// Per-segment relative import fixes inside flattened dirs
for (const name of fs.readdirSync(kbRoot)) {
  const segmentDir = path.join(kbRoot, name);
  if (!fs.statSync(segmentDir).isDirectory()) continue;
  const segRepl = importReplacements.filter((r) => r.seg === name);
  for (const entry of fs.readdirSync(segmentDir)) {
    const fp = path.join(segmentDir, entry);
    if (!fs.statSync(fp).isFile() || !/\.tsx?$/.test(entry)) continue;
    let text = fs.readFileSync(fp, 'utf8');
    let changed = false;
    for (const r of segRepl) {
      for (const [a, b] of [
        [r.oldDot, r.newDot],
        [r.oldDot + '.js', r.newDot + '.js'],
      ]) {
        if (text.includes(a)) {
          text = text.split(a).join(b);
          changed = true;
        }
      }
    }
    if (changed) fs.writeFileSync(fp, text);
  }
}

console.log(`Moved ${moveMap.size} files under pages/kb/*/screen`);
