import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

import { applyTestConfigEnv } from './load-test-config.ts';

const e2eRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(e2eRoot, '../..');
const webRoot = path.join(repoRoot, 'web');
const desktopE2e = process.env.BASIS_E2E_DESKTOP === '1';
const e2eProfile = applyTestConfigEnv(desktopE2e);
/** Isolated from daily dev (defaults 8090 / 5173 / HMR 24678); ports from tests/test.yaml. */
const webPort = Number(process.env.BASIS_E2E_WEB_PORT ?? String(e2eProfile.web_port));
const apiPort = Number(process.env.BASIS_E2E_API_PORT ?? String(e2eProfile.api_port));
const hmrPort = Number(
  process.env.BASIS_E2E_HMR_PORT ?? String(e2eProfile.hmr_port ?? webPort + 19505),
);
const baseURL = `http://127.0.0.1:${webPort}`;

/** PATH/Locale/CI only — avoid inheriting repo `.env` / `VITE_*` into E2E child processes. */
const E2E_INHERIT_ENV_KEYS = [
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'LC_ALL',
  'NODE_OPTIONS',
  'npm_config_cache',
  'CI',
  'FORCE_COLOR',
  'NO_COLOR',
  'UV_CACHE_DIR',
] as const;

function e2eChildEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of E2E_INHERIT_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== '') env[key] = value;
  }
  return { ...env, ...overrides };
}

function e2eApiEnv(): Record<string, string> {
  const overrides: Record<string, string> = {
    BASIS_DATABASE_URL: '',
    BASIS_DATA_DIR: e2eProfile.data_dir,
    BASIS_E2E: '1',
    BASIS_HOST: '127.0.0.1',
    BASIS_PORT: String(apiPort),
    BASIS_INGEST_INLINE: '1',
  };
  if (e2eProfile.demo_workspace) {
    overrides.BASIS_DEMO_WORKSPACE = '1';
  }
  if (desktopE2e) {
    overrides.BASIS_DEPLOYMENT_PROFILE = 'desktop';
    overrides.BASIS_PROFILE = 'desktop';
  }
  return e2eChildEnv(overrides);
}

const apiServerCommand = desktopE2e ? 'uv run basis serve --profile desktop' : 'uv run basis';

const webServerCommand = desktopE2e
  ? `npx vite --mode desktop --host 127.0.0.1 --port ${webPort} --strictPort`
  : 'node --experimental-strip-types server/dev.ts';

const apiOrigin = `http://127.0.0.1:${apiPort}`;

const webServerEnv: Record<string, string> = desktopE2e
  ? e2eChildEnv({
      BASIS_E2E: '1',
      BASIS_API_URL: apiOrigin,
      VITE_BASIS_AUTH_REQUIRED: 'false',
      VITE_BASIS_DESKTOP: 'true',
      WEB_HMR_PORT: String(hmrPort),
    })
  : e2eChildEnv({
      BASIS_E2E: '1',
      BASIS_API_URL: apiOrigin,
      WEB_PORT: String(webPort),
      WEB_HOST: '127.0.0.1',
      WEB_HMR_PORT: String(hmrPort),
    });

export default defineConfig({
  testDir: path.join(e2eRoot, 'specs'),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    viewport: { width: 1536, height: 960 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1536, height: 960 },
      },
    },
  ],
  webServer: process.env.BASIS_E2E_SKIP_SERVERS
    ? undefined
    : [
        {
          command: apiServerCommand,
          cwd: repoRoot,
          env: e2eApiEnv(),
          url: `http://127.0.0.1:${apiPort}/health`,
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: webServerCommand,
          cwd: webRoot,
          env: webServerEnv,
          url: baseURL,
          reuseExistingServer: process.env.BASIS_E2E_REUSE_SERVERS === '1',
          timeout: 120_000,
        },
      ],
});
