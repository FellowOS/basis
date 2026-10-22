import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageRoot, '..');
const webPort = Number(process.env.BASIS_E2E_WEB_PORT ?? '5174');
const apiPort = Number(process.env.BASIS_E2E_API_PORT ?? '8091');
const baseURL = `http://127.0.0.1:${webPort}`;
const desktopE2e = process.env.BASIS_E2E_DESKTOP === '1';

function e2eApiEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  // Empty string prevents repo `.env` Postgres URL from being applied after load_dotenv().
  env.BASIS_DATABASE_URL = '';
  env.BASIS_DATA_DIR = desktopE2e ? 'data/e2e-desktop' : 'data/e2e';
  env.BASIS_HOST = '127.0.0.1';
  env.BASIS_PORT = String(apiPort);
  env.BASIS_INGEST_INLINE = '1';
  env.BASIS_DEMO_WORKSPACE = '1';
  if (desktopE2e) {
    env.BASIS_DEPLOYMENT_PROFILE = 'desktop';
    env.BASIS_PROFILE = 'desktop';
  }
  return env;
}

const apiServerCommand = desktopE2e ? 'uv run basis serve --profile desktop' : 'uv run basis';

const webServerCommand = desktopE2e
  ? `npx vite --mode desktop --host 127.0.0.1 --port ${webPort} --strictPort`
  : 'node --experimental-strip-types server/dev.ts';

const webServerEnv: Record<string, string> = desktopE2e
  ? {
      ...process.env,
      VITE_BASIS_API_URL: `http://127.0.0.1:${apiPort}`,
    }
  : {
      ...process.env,
      BASIS_API_URL: `http://127.0.0.1:${apiPort}`,
      WEB_PORT: String(webPort),
      WEB_HOST: '127.0.0.1',
    };

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
          // Always start a fresh API so it matches `data/e2e` after globalSetup.
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command: webServerCommand,
          cwd: packageRoot,
          env: webServerEnv,
          url: baseURL,
          reuseExistingServer: process.env.BASIS_E2E_REUSE_SERVERS === '1',
          timeout: 120_000,
        },
      ],
});
