import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  materializeCopiedTree,
  normalizeWindowsPython3Launcher,
} from './relocate-packaged-venv.mjs';

describe('materializeCopiedTree', () => {
  it('replaces file symlinks with real files', () => {
    if (process.platform === 'win32') return;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'basis-mat-'));
    const target = path.join(root, 'python.exe');
    const link = path.join(root, 'python3.exe');
    fs.writeFileSync(target, 'stub');
    fs.symlinkSync(target, link);
    assert.ok(fs.lstatSync(link).isSymbolicLink());

    materializeCopiedTree(root);
    assert.ok(fs.statSync(link).isFile());
    assert.ok(!fs.lstatSync(link).isSymbolicLink());
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('normalizeWindowsPython3Launcher', () => {
  it('no-op on unix', () => {
    if (process.platform === 'win32') return;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'basis-py3-'));
    const py = path.join(root, 'python.exe');
    fs.writeFileSync(py, 'a');
    normalizeWindowsPython3Launcher(root);
    assert.ok(!fs.existsSync(path.join(root, 'python3.exe')));
    fs.rmSync(root, { recursive: true, force: true });
  });
});
