#!/usr/bin/env node
/**
 * Hoist graph.canvas.canvas string leaves into graph.canvas (one level).
 * Run once: node scripts/flatten-graph-canvas-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function flattenCanvasBlock(source) {
  const marker = '  canvas: {\n    canvas: {';
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error('Expected nested canvas.canvas block');
  }
  const innerStart = start + '  canvas: {\n    canvas: {'.length;
  let depth = 1;
  let i = innerStart;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  const innerEnd = i - 1;
  const innerBody = source.slice(innerStart, innerEnd).trimEnd();
  const hoisted = innerBody
    .split('\n')
    .map((line) => (line.startsWith('      ') ? line.slice(2) : line))
    .join('\n');

  const afterInner = source.slice(i);
  const siblingMatch = afterInner.match(/^\s*,\n([\s\S]*)$/);
  if (!siblingMatch) throw new Error('Could not find siblings after inner canvas');
  const siblings = siblingMatch[1];

  const before = source.slice(0, start);
  return `${before}  canvas: {\n${hoisted}\n${siblings}`;
}

for (const locale of ['en', 'zh']) {
  const path = join(webRoot, `src/modules/graph/i18n/${locale}/index.ts`);
  const next = flattenCanvasBlock(readFileSync(path, 'utf8'));
  if (next.includes('canvas: {\n    canvas: {')) {
    throw new Error(`Still nested after flatten: ${locale}`);
  }
  writeFileSync(path, next);
  console.log(`flattened ${locale}`);
}
