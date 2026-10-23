import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(e2eDir, '..');

type JsonObject = Record<string, unknown>;

export function testConfigPath(): string {
  const fromEnv = process.env.BASIS_TEST_CONFIG?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(testsDir, 'test.yaml');
}

export function loadTestConfig(): JsonObject {
  const main = testConfigPath();
  if (!fs.existsSync(main)) return {};
  return (yaml.parse(fs.readFileSync(main, 'utf8')) as JsonObject) ?? {};
}

type E2eProfile = {
  api_port: number;
  web_port: number;
  hmr_port?: number;
  data_dir: string;
  demo_workspace: boolean;
};

const E2E_DEFAULTS: E2eProfile = {
  api_port: 8091,
  web_port: 5174,
  data_dir: 'data/e2e',
  demo_workspace: true,
};

const E2E_DESKTOP_DEFAULTS: E2eProfile = {
  api_port: 8092,
  web_port: 5175,
  data_dir: 'data/e2e-desktop',
  demo_workspace: true,
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asPort(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return fallback;
}

export function resolveE2eProfile(desktop: boolean): E2eProfile {
  const cfg = loadTestConfig();
  const defaults = desktop ? E2E_DESKTOP_DEFAULTS : E2E_DEFAULTS;
  const block = asObject(desktop ? cfg.e2e_desktop : cfg.e2e);
  const hmr =
    block.hmr_port !== undefined && block.hmr_port !== null
      ? asPort(block.hmr_port, defaults.web_port + 19505)
      : undefined;
  return {
    api_port: asPort(block.api_port, defaults.api_port),
    web_port: asPort(block.web_port, defaults.web_port),
    hmr_port: hmr,
    data_dir: typeof block.data_dir === 'string' && block.data_dir.trim()
      ? block.data_dir.trim()
      : defaults.data_dir,
    demo_workspace:
      typeof block.demo_workspace === 'boolean'
        ? block.demo_workspace
        : defaults.demo_workspace,
  };
}

function setEnvIfEmpty(key: string, value: string | undefined): void {
  if (!value?.trim()) return;
  if (!process.env[key]?.trim()) process.env[key] = value.trim();
}

/** Apply shared YAML to process.env (env vars already set win). */
export function applyTestConfigEnv(desktop: boolean): E2eProfile {
  const profile = resolveE2eProfile(desktop);
  setEnvIfEmpty('BASIS_E2E_API_PORT', String(profile.api_port));
  setEnvIfEmpty('BASIS_E2E_WEB_PORT', String(profile.web_port));
  if (profile.hmr_port !== undefined) {
    setEnvIfEmpty('BASIS_E2E_HMR_PORT', String(profile.hmr_port));
  }
  if (profile.demo_workspace) {
    setEnvIfEmpty('BASIS_DEMO_WORKSPACE', '1');
  }
  const cfg = loadTestConfig();
  const gh = asObject(cfg.github);
  setEnvIfEmpty('BASIS_E2E_GITHUB_TOKEN', typeof gh.token === 'string' ? gh.token : undefined);
  setEnvIfEmpty('BASIS_TEST_GITHUB_TOKEN', typeof gh.token === 'string' ? gh.token : undefined);
  setEnvIfEmpty('BASIS_TEST_GITHUB_OWNER', typeof gh.owner === 'string' ? gh.owner : undefined);
  setEnvIfEmpty('BASIS_TEST_GITHUB_REPO', typeof gh.repo === 'string' ? gh.repo : undefined);
  if (gh.e2e_run_sync === true || gh.e2e_run_sync === '1') {
    setEnvIfEmpty('BASIS_E2E_GITHUB_RUN_SYNC', '1');
  }
  return profile;
}
