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

async function browserAuthMeIsPlatformAdmin(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const token = localStorage.getItem('basis_token');
    if (!token) {
      return false;
    }
    const res = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return false;
    }
    const body = (await res.json()) as { user?: { is_admin?: boolean } };
    return body.user?.is_admin === true;
  });
}

/** Wait until API + browser token reflect a platform admin session. */
export async function waitForPlatformAdminSession(page: Page): Promise<void> {
  await expect
    .poll(async () => browserAuthMeIsPlatformAdmin(page), { timeout: 60_000 })
    .toBe(true);
}

/** Log in through the SPA so `BasisSessionProvider` loads the session user. */
export async function applyWorkspaceSessionLogin(page: Page, creds: AdminFixture): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?mode=login');
  await page.locator('input[name="email"]').fill(creds.email);
  await page.locator('input[name="password"]').fill(creds.password);
  const loginDone = page.waitForResponse(
    (response) => response.url().includes('/api/v1/auth/login') && response.status() === 200,
    { timeout: 60_000 },
  );
  await page.locator('form button[type="submit"]').click();
  await loginDone;
  await expect(page).toHaveURL(/\/workspaces\//, { timeout: 60_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/workspaces\//, { timeout: 60_000 });
}

/** Platform admin: UI login + `/auth/me` reports `is_admin`. */
export async function applySessionLogin(page: Page, creds: AdminFixture): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?mode=login');
  await page.locator('input[name="email"]').fill(creds.email);
  await page.locator('input[name="password"]').fill(creds.password);
  const loginDone = page.waitForResponse(
    (response) => response.url().includes('/api/v1/auth/login') && response.status() === 200,
    { timeout: 60_000 },
  );
  await page.locator('form button[type="submit"]').click();
  const loginResponse = await loginDone;
  const loginBody = (await loginResponse.json()) as { user?: { is_admin?: boolean } };
  expect(loginBody.user?.is_admin, 'login response missing platform admin flag').toBe(true);
  await expect(page).toHaveURL(/\/workspaces\//, { timeout: 60_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForPlatformAdminSession(page);
}

/** Persist token and remount the SPA so `BasisSessionProvider` reloads `/auth/me`. */
export async function syncBrowserAuthToken(page: Page, token: string): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('basis_token', t);
  }, token);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/** Platform admin UI: reuse saved fixture or register the bootstrap admin, then log in. */
export async function ensurePlatformAdminSession(page: Page): Promise<AdminFixture> {
  async function loginOrNull(): Promise<AdminFixture | null> {
    try {
      return await loginPlatformAdmin(page);
    } catch {
      return null;
    }
  }

  let creds = await loginOrNull();
  if (creds) {
    try {
      await waitForPlatformAdminSession(page);
      return creds;
    } catch {
      clearAdminFixture();
      creds = null;
    }
  }

  const reset = await page.request.post(`${e2eApiBaseUrl()}/api/v1/_e2e/playwright-reset`);
  expect(reset.ok(), `playwright-reset failed: ${reset.status()} ${await reset.text()}`).toBeTruthy();
  clearAdminFixture();

  const stamp = Date.now();
  const bootstrap: AdminFixture = {
    email: `e2e-admin-${stamp}@e2e.invalid`,
    password: 'password1xy',
  };
  const reg = await page.request.post(`${e2eApiBaseUrl()}/api/v1/auth/register`, {
    data: { email: bootstrap.email, password: bootstrap.password, display_name: 'E2E Admin' },
  });
  expect(reg.ok(), `bootstrap register failed: ${reg.status()} ${await reg.text()}`).toBeTruthy();
  const regBody = (await reg.json()) as { user?: { is_admin?: boolean } };
  expect(regBody.user?.is_admin, 'bootstrap register did not create a platform admin user').toBe(true);
  writeAdminFixture(bootstrap);
  await applySessionLogin(page, bootstrap);
  return bootstrap;
}

export async function gotoPlatformAdminPath(page: Page, path: string): Promise<void> {
  const pathPattern = new RegExp(path.replace(/\//g, '\\/'));
  await waitForPlatformAdminSession(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(pathPattern, { timeout: 60_000 });
  await expect(page.getByRole('link', { name: /administration|管理/i })).toBeVisible({
    timeout: 60_000,
  });
}

export async function loginPlatformAdmin(page: Page): Promise<AdminFixture> {
  const saved = readAdminFixture();
  if (!saved) {
    throw new Error(
      'platform admin fixture missing; run any test that registers the first user in data/e2e first',
    );
  }
  await applySessionLogin(page, saved);
  return saved;
}
