import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Page } from '@playwright/test';

import { e2eApiBaseUrl } from './api-v1-path.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ADMIN_FIXTURE_PATH = path.join(repoRoot, 'data', 'e2e', 'playwright-admin.json');

type AdminFixture = { email: string; password: string };

function readAdminFixture(): AdminFixture | null {
  try {
    if (!fs.existsSync(ADMIN_FIXTURE_PATH)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(ADMIN_FIXTURE_PATH, 'utf8')) as AdminFixture;
  } catch {
    return null;
  }
}

function writeAdminFixture(fixture: AdminFixture): void {
  fs.mkdirSync(path.dirname(ADMIN_FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(ADMIN_FIXTURE_PATH, JSON.stringify(fixture));
}

function clearAdminFixture(): void {
  try {
    fs.rmSync(ADMIN_FIXTURE_PATH, { force: true });
  } catch {
    // ignore
  }
}

export async function persistPlatformAdminIfApplicable(
  page: Page,
  creds: AdminFixture,
  token: string,
): Promise<void> {
  const meRes = await page.request.get(`${e2eApiBaseUrl()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok()) {
    return;
  }
  const me = (await meRes.json()) as { user?: { is_admin?: boolean } };
  if (me.user?.is_admin) {
    writeAdminFixture(creds);
  }
}

async function authMeIsPlatformAdmin(page: Page, token: string): Promise<boolean> {
  const meRes = await page.request.get(`${e2eApiBaseUrl()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok()) {
    return false;
  }
  const me = (await meRes.json()) as { user?: { is_admin?: boolean } };
  return me.user?.is_admin === true;
}

/** Wait until API + browser token reflect a platform admin session. */
export async function waitForPlatformAdminSession(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const token = await page.evaluate(() => localStorage.getItem('basis_token'));
        if (!token) {
          return false;
        }
        return authMeIsPlatformAdmin(page, token);
      },
      { timeout: 60_000 },
    )
    .toBe(true);
}

async function applySessionToken(page: Page, token: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((t) => localStorage.setItem('basis_token', t), token);
  await page.goto('/workspaces');
  await expect(page).toHaveURL(/\/workspaces/, { timeout: 60_000 });
  await waitForPlatformAdminSession(page);
}

export async function loginPlatformAdmin(page: Page): Promise<AdminFixture> {
  const saved = readAdminFixture();
  if (!saved) {
    throw new Error(
      'platform admin fixture missing; run any test that registers the first user in data/e2e first',
    );
  }
  const login = await page.request.post(`${e2eApiBaseUrl()}/api/v1/auth/login`, {
    data: { email: saved.email, password: saved.password },
  });
  if (!login.ok()) {
    clearAdminFixture();
    throw new Error(`admin login failed: ${login.status()} ${await login.text()}`);
  }
  const body = (await login.json()) as { token: string };
  await applySessionToken(page, body.token);
  return saved;
}
