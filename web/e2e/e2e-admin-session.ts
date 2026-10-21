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

export async function loginPlatformAdmin(page: Page): Promise<AdminFixture> {
  const saved = readAdminFixture();
  if (saved) {
    const login = await page.request.post(`${e2eApiBaseUrl()}/api/v1/auth/login`, {
      data: { email: saved.email, password: saved.password },
    });
    expect(login.ok(), `admin login failed: ${login.status()} ${await login.text()}`).toBeTruthy();
    const body = (await login.json()) as { token: string };
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.evaluate((token) => localStorage.setItem('basis_token', token), body.token);
    await page.goto('/kbs');
    await expect(page).toHaveURL(/\/kbs/, { timeout: 60_000 });
    return saved;
  }
  throw new Error(
    'platform admin fixture missing; run any test that registers the first user in data/e2e first',
  );
}
