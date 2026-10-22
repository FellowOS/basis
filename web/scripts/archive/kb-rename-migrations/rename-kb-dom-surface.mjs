#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dirs = [path.join(root, 'src'), path.join(root, 'e2e')];

const pairs = [
  ['kb-ws-console', 'basis-ws-console'],
  ['kb-governance-ws', 'basis-governance-ws'],
  ['kb-lineage-shell', 'basis-lineage-shell'],
  ['kb-lineage-flow', 'basis-lineage-flow'],
  ['kb-graph-canvas', 'basis-graph-canvas'],
  ['kb-graph-diff-page', 'basis-graph-diff-page'],
  ['kb-library-shell', 'basis-library-shell'],
  ['kb-processing-view', 'basis-processing-view'],
  ['kb-vocabulary-hub', 'basis-vocabulary-hub'],
  ['data-kb-id', 'data-workspace-id'],
  ['id="kb-search-scope"', 'id="workspace-search-scope"'],
  ['htmlFor="kb-search-scope"', 'htmlFor="workspace-search-scope"'],
  ["'kb-search-as-of'", "'workspace-search-as-of'"],
  ["'kb-search-at'", "'workspace-search-at'"],
  ['id="kb-create-name"', 'id="workspace-create-name"'],
  ['htmlFor="kb-create-name"', 'htmlFor="workspace-create-name"'],
  ['kb-document-timeline-heading', 'workspace-document-timeline-heading'],
  ['kb-surface-phrases-dialog', 'workspace-surface-phrases-dialog'],
  ['id="kb-rule-', 'id="workspace-rule-'],
  ['htmlFor="kb-rule-', 'htmlFor="workspace-rule-'],
  ['kb-library-page', 'library sources page'],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'openapi') continue;
      walk(p, files);
    } else if (/\.(tsx?|mjs|spec\.ts)$/.test(ent.name)) {
      files.push(p);
    }
  }
  return files;
}

const files = dirs.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
let n = 0;
for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  let next = s;
  for (const [from, to] of pairs) next = next.split(from).join(to);
  if (next !== s) {
    fs.writeFileSync(file, next);
    n++;
  }
}
console.log(`updated ${n} files`);
