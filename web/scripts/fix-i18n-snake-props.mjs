#!/usr/bin/env node
/**
 * Fix TS2551: camelCase property access on snake_case locale objects.
 * Parses `tsc` output for "Did you mean 'snake_key'?" and renames at column.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TSC_LINE =
  /^(?<file>[^(\s]+)\((?<line>\d+),(?<col>\d+)\): error TS2551: Property '(?<bad>[^']+)' does not exist on type .+ Did you mean '(?<good>[^']+)'\?/;

function runTsc() {
  try {
    return execSync('npx tsc --noEmit', {
      cwd: WEB_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (e) {
    const out = [e.stdout, e.stderr].filter(Boolean).join('\n');
    return out || String(e);
  }
}

function applyFix(file, lineNum, col, bad, good) {
  const abs = path.isAbsolute(file) ? file : path.join(WEB_ROOT, file);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const idx = lineNum - 1;
  const line = lines[idx];
  if (!line) return false;

  const before = line.slice(0, col - 1);
  const after = line.slice(col - 1);
  if (!after.startsWith(bad)) {
    const alt = line.indexOf(`.${bad}`);
    if (alt === -1) return false;
    const prefix = line.slice(0, alt + 1);
    const rest = line.slice(alt + 1 + bad.length);
    lines[idx] = `${prefix}${good}${rest}`;
    fs.writeFileSync(abs, lines.join('\n'));
    return true;
  }
  lines[idx] = `${before}${good}${after.slice(bad.length)}`;
  fs.writeFileSync(abs, lines.join('\n'));
  return true;
}

function parseFixes(output) {
  const fixes = [];
  for (const line of output.split('\n')) {
    const m = line.match(TSC_LINE);
    if (m) fixes.push(m.groups);
  }
  return fixes;
}

let round = 0;
let total = 0;
const maxRounds = 30;

while (round < maxRounds) {
  round += 1;
  const out = runTsc();
  const fixes = parseFixes(out);
  if (fixes.length === 0) {
    if (round === 1 && !out.includes('error TS')) {
      console.log('typecheck already clean');
    } else {
      console.log(`round ${round}: no TS2551 fixes; remaining errors in tsc output`);
      if (out.includes('error TS')) {
        const n = (out.match(/error TS/g) || []).length;
        console.log(`approx ${n} errors left`);
      }
    }
    break;
  }

  const byFileLine = new Map();
  for (const f of fixes) {
    const key = `${f.file}:${f.line}:${f.bad}`;
    byFileLine.set(key, f);
  }
  const unique = [...byFileLine.values()];
  let applied = 0;
  for (const f of unique) {
    if (applyFix(f.file, Number(f.line), Number(f.col), f.bad, f.good)) applied += 1;
  }
  total += applied;
  console.log(`round ${round}: applied ${applied} fixes (${fixes.length} hints)`);
  if (applied === 0) break;
}

console.log(`done: ${total} property renames in ${round} round(s)`);
