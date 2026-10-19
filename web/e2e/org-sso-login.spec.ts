import { expect, test } from '@playwright/test';

import { e2eApiBaseUrl } from './api-v1-path.js';
import { registerFreshUser } from './helpers';

async function orgIdForUser(page: import('@playwright/test').Page, token: string): Promise<string> {
  const api = e2eApiBaseUrl();
  let orgId: string | undefined;
  await expect
    .poll(async () => {
      const mine = await page.request.get(`${api}/api/v1/orgs/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!mine.ok()) return '';
      const body = (await mine.json()) as { organizations?: Array<{ id: string }> };
      orgId = body.organizations?.[0]?.id;
      return orgId ?? '';
    }, { timeout: 30_000 })
    .not.toBe('');
  return orgId!;
}

test('org SSO hint and login UI follow auth_policy', async ({ page }) => {
  test.setTimeout(120_000);

  const { email } = await registerFreshUser(page);
  const domain = email.split('@')[1];
  expect(domain).toBeTruthy();

  const token = await page.evaluate(() => localStorage.getItem('basis_token'));
  expect(token).toBeTruthy();

  const api = e2eApiBaseUrl();
  const orgId = await orgIdForUser(page, token!);

  async function upsertOidc(authPolicy: string) {
    const put = await page.request.put(`${api}/api/v1/orgs/${orgId}/oidc`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        issuer: 'https://idp.example.com/application/o/basis-e2e/',
        client_id: 'e2e-client',
        client_secret: 'e2e-secret',
        scopes: 'openid email profile',
        email_domains: [domain],
        enabled: true,
        auth_policy: authPolicy,
      },
    });
    expect(put.ok(), `oidc upsert failed: ${put.status()} ${await put.text()}`).toBeTruthy();
  }

  await upsertOidc('sso_preferred');

  const hint = await page.request.get(
    `${api}/api/v1/auth/org-sso-hint?email=${encodeURIComponent(email)}`,
  );
  expect(hint.ok()).toBeTruthy();
  const hintBody = (await hint.json()) as { available?: boolean; password_login_allowed?: boolean };
  expect(hintBody.available).toBe(true);
  expect(hintBody.password_login_allowed).toBe(true);

  await page.evaluate(() => localStorage.removeItem('basis_token'));
  await page.goto('/?mode=login');
  await expect(page.getByTestId('login-org-sso')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Email|邮箱/i).fill(email);
  await expect(page.locator('form button[type="submit"]')).toBeVisible();

  await upsertOidc('sso_required');

  const hintRequired = await page.request.get(
    `${api}/api/v1/auth/org-sso-hint?email=${encodeURIComponent(email)}`,
  );
  const requiredBody = (await hintRequired.json()) as { password_login_allowed?: boolean };
  expect(requiredBody.password_login_allowed).toBe(false);

  await page.goto('/?mode=login');
  await expect(page.getByTestId('login-org-sso')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Email|邮箱/i).fill(email);
  await expect
    .poll(async () => page.locator('form button[type="submit"]').count(), { timeout: 15_000 })
    .toBe(0);
});
