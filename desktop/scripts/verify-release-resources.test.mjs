import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { collectReleaseResourceErrors } from './verify-release-resources-lib.mjs';

function mkFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'basis-release-fixture-'));
  const webDistDir = path.join(root, 'dist', 'web');
  const profilesDir = path.join(root, 'profiles');
  const apiStageDir = path.join(root, '.api-stage');
  fs.mkdirSync(webDistDir, { recursive: true });
  fs.mkdirSync(profilesDir, { recursive: true });
  fs.mkdirSync(apiStageDir, { recursive: true });
  fs.writeFileSync(path.join(webDistDir, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(profilesDir, 'profile.desktop.yaml'), 'deployment: {}\n');
  return { root, webDistDir, profilesDir, apiStageDir };
}

describe('collectReleaseResourceErrors', () => {
  it('accepts uv-monorepo manifest', () => {
    const { root, webDistDir, profilesDir, apiStageDir } = mkFixture();
    fs.writeFileSync(
      path.join(apiStageDir, 'api-manifest.json'),
      JSON.stringify({ kind: 'uv-monorepo' }),
    );
    fs.writeFileSync(path.join(apiStageDir, 'monorepo-root.json'), '{}');

    const errors = collectReleaseResourceErrors({ webDistDir, profilesDir, apiStageDir });
    assert.deepEqual(errors, []);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('accepts bundled-venv manifest on unix', () => {
    if (process.platform === 'win32') return;
    const { root, webDistDir, profilesDir, apiStageDir } = mkFixture();
    fs.writeFileSync(
      path.join(apiStageDir, 'api-manifest.json'),
      JSON.stringify({ kind: 'bundled-venv' }),
    );
    const basisBin = path.join(apiStageDir, 'sidecar', 'venv', 'bin', 'basis');
    fs.mkdirSync(path.dirname(basisBin), { recursive: true });
    fs.writeFileSync(basisBin, '');
    const runtimeBin = path.join(apiStageDir, 'sidecar', 'runtime', 'cpython', 'bin');
    fs.mkdirSync(runtimeBin, { recursive: true });

    const errors = collectReleaseResourceErrors({ webDistDir, profilesDir, apiStageDir });
    assert.deepEqual(errors, []);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports missing web build and unknown manifest kind', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'basis-release-bad-'));
    const webDistDir = path.join(root, 'dist', 'web');
    const profilesDir = path.join(root, 'profiles');
    const apiStageDir = path.join(root, '.api-stage');
    fs.mkdirSync(profilesDir, { recursive: true });
    fs.mkdirSync(apiStageDir, { recursive: true });
    fs.writeFileSync(path.join(profilesDir, 'profile.desktop.yaml'), '');
    fs.writeFileSync(
      path.join(apiStageDir, 'api-manifest.json'),
      JSON.stringify({ kind: 'unknown' }),
    );

    const errors = collectReleaseResourceErrors({ webDistDir, profilesDir, apiStageDir });
    assert.ok(errors.some((e) => e.includes('web build')));
    assert.ok(errors.some((e) => e.includes('unknown api-manifest kind')));
    fs.rmSync(root, { recursive: true, force: true });
  });
});
