import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageRoot, '..');
const webPort = Number(process.env.BASIS_E2E_WEB_PORT ?? '5174');
const apiPort = Number(process.env.BASIS_E2E_API_PORT ?? '8091');
const baseURL = `http://127.0.0.1:${webPort}`;

function e2eApiEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  // Empty string prevents repo `.env` Postgres URL from being applied after load_dotenv().
  env.BASIS_DATABASE_URL = '';
  env.BASIS_DATA_DIR = 'data-e2e';
  env.BASIS_HOST = '127.0.0.1';
  env.BASIS_PORT = String(apiPort);
  env.BASIS_INGEST_INLINE = '1';
  return env;
}

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
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
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.BASIS_E2E_SKIP_SERVERS
    ? undefined
    : [
        {
          command: 'uv run basis',
          cwd: repoRoot,
          env: e2eApiEnv(),
          url: `http://127.0.0.1:${apiPort}/health`,
          // Always start a fresh API so it matches `data-e2e` after globalSetup.
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: 'node --experimental-strip-types server/dev.ts',
          cwd: packageRoot,
          env: {
            ...process.env,
            BASIS_API_URL: `http://127.0.0.1:${apiPort}`,
            WEB_PORT: String(webPort),
            WEB_HOST: '127.0.0.1',
          },
          url: baseURL,
          reuseExistingServer: process.env.BASIS_E2E_REUSE_SERVERS === '1',
          timeout: 120_000,
        },
      ],
});
