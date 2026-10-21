#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dirs = [path.join(root, 'src'), path.join(root, 'e2e')];

const pairs = [
  ['refreshKbs', 'refreshWorkspaces'],
  ['getKb', 'getWorkspace'],
  ['setKbs', 'setWorkspaces'],
  ["useWorkspaceCatalog>['kbs']", "useWorkspaceCatalog>['workspaces']"],
  ['{ kbs,', '{ workspaces,'],
  ['{ kbs }', '{ workspaces }'],
  ['(kbs)', '(workspaces)'],
  [', kbs)', ', workspaces)'],
  [', kbs:', ', workspaces:'],
  ['(kbs:', '(workspaces:'],
  ['kbs.length', 'workspaces.length'],
  ['kbs.find', 'workspaces.find'],
  ['kbs.some', 'workspaces.some'],
  ['kbs.map', 'workspaces.map'],
  ['kbs[0]', 'workspaces[0]'],
  ['[kbs,', '[workspaces,'],
  [' kbs,', ' workspaces,'],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'openapi') continue;
      walk(p, files);
    } else if (/\.(tsx?|mjs)$/.test(ent.name)) {
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
