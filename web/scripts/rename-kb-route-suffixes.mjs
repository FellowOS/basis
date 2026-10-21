/** DEPRECATED — one-off rename under legacy `pages/kb/`; routes are now `modules/<segment>/`. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/kb');

/** @type {[string, string][]} relative paths under pages/kb */
const renames = [
  ['alerts/alerts-page.tsx', 'alerts/page.tsx'],
  ['analyze/analyze-page.tsx', 'analyze/page.tsx'],
  ['analyze/sparql-screen.tsx', 'analyze/sparql.tsx'],
  ['analyze/reasoning-screen.tsx', 'analyze/reasoning.tsx'],
  ['analyze/reasoning-input-panel.tsx', 'analyze/reasoning-input.tsx'],
  ['analyze/reasoning-results-panel.tsx', 'analyze/reasoning-results.tsx'],
  ['connectors/connectors-page.tsx', 'connectors/page.tsx'],
  ['connectors/connectors-mapping-new-page.tsx', 'connectors/mapping-new.tsx'],
  ['connectors/connectors-mapping-edit-page.tsx', 'connectors/mapping-edit.tsx'],
  ['connectors/connectors-oauth-callback-page.tsx', 'connectors/oauth-callback.tsx'],
  ['data-onboarding/data-onboarding-page.tsx', 'data-onboarding/page.tsx'],
  ['decisions/decisions-page.tsx', 'decisions/page.tsx'],
  ['decisions/decisions-panel.tsx', 'decisions/panel.tsx'],
  ['decisions/decisions-screen.tsx', 'decisions/screen.tsx'],
  ['decisions/decisions-screen-copy.ts', 'decisions/screen-copy.ts'],
  ['entities/entities-page.tsx', 'entities/page.tsx'],
  ['entity-resolution/entity-resolution-page.tsx', 'entity-resolution/page.tsx'],
  ['entity-resolution/entity-resolution-panel.tsx', 'entity-resolution/panel.tsx'],
  ['entity-resolution/entity-resolution-screen.tsx', 'entity-resolution/screen.tsx'],
  ['graph/graph-page.tsx', 'graph/page.tsx'],
  ['graph/graph-diff-page.tsx', 'graph/diff.tsx'],
  ['graph/graph-screen.tsx', 'graph/screen.tsx'],
  ['graph/graph-screen-copy.ts', 'graph/screen-copy.ts'],
  ['graph/graph-inspector-panel.tsx', 'graph/inspector.tsx'],
  ['graph/timeline-panel.tsx', 'graph/timeline.tsx'],
  ['integration/integration-page.tsx', 'integration/page.tsx'],
  ['library/library-page.tsx', 'library/page.tsx'],
  ['library/sources-page.tsx', 'library/sources.tsx'],
  ['lineage/lineage-page.tsx', 'lineage/page.tsx'],
  ['mappings/mappings-page.tsx', 'mappings/page.tsx'],
  ['ontology/ontology-page.tsx', 'ontology/page.tsx'],
  ['processing/processing-page.tsx', 'processing/page.tsx'],
  ['processing/processing-screen.tsx', 'processing/screen.tsx'],
  ['review/review-page.tsx', 'review/page.tsx'],
  ['search/search-page.tsx', 'search/page.tsx'],
  ['settings/settings-page.tsx', 'settings/page.tsx'],
  ['setup/setup-page.tsx', 'setup/page.tsx'],
  ['vocabulary/vocabulary-page.tsx', 'vocabulary/page.tsx'],
  ['vocabulary/vocabulary-panel.tsx', 'vocabulary/panel.tsx'],
  ['vocabulary/vocabulary-screen.tsx', 'vocabulary/screen.tsx'],
  ['vocabulary/property-panel.tsx', 'vocabulary/property.tsx'],
];

const importMap = new Map();
for (const [from, to] of renames) {
  const fromBase = from.replace(/\.tsx?$/, '');
  const toBase = to.replace(/\.tsx?$/, '');
  importMap.set(fromBase, toBase);
  importMap.set(`pages/kb/${fromBase}`, `pages/kb/${toBase}`);
}

for (const [from, to] of renames) {
  const a = path.join(kbRoot, from);
  const b = path.join(kbRoot, to);
  if (!fs.existsSync(a)) {
    console.warn('skip missing', from);
    continue;
  }
  fs.renameSync(a, b);
}

const webRoot = path.resolve(kbRoot, '../..');
const roots = [webRoot, path.resolve(webRoot, '../e2e'), path.resolve(webRoot, '../openapi')];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    if (/\.(tsx?|md|mjs|json)$/.test(dir)) out.push(dir);
    return out;
  }
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    walk(path.join(dir, name), out);
  }
  return out;
}

const files = [];
for (const r of roots) walk(r, files);
files.push(path.resolve(webRoot, '../AGENTS.md'));
files.push(path.resolve(webRoot, '../docs'));

for (const fp of files) {
  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) continue;
  if (!/\.(tsx?|md|mjs|json)$/.test(fp)) continue;
  let text = fs.readFileSync(fp, 'utf8');
  let next = text;
  const sorted = [...importMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of sorted) {
    next = next.split(from).join(to);
  }
  if (next !== text) fs.writeFileSync(fp, next);
}

console.log(`Renamed ${renames.length} route files.`);
