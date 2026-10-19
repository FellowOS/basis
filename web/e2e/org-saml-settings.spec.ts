import { expect, test } from '@playwright/test';

import { e2eApiBaseUrl } from './api-v1-path.js';
import { registerFreshUser } from './helpers';

const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHBfpEWqJzTMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
Y2FsaG9zdDAeFw0yNTAxMDEwMDAwMDBaFw00NTAxMDEwMDAwMDBaMBQxEjAQBgNV
BAMMCWxvY2FsaG9zdDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABDummyCertFor
TestsOnlyNotValid==
-----END CERTIFICATE-----`;

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

test('settings shows SAML panel after API configure', async ({ page }) => {
  test.setTimeout(120_000);

  const { email } = await registerFreshUser(page);
  const domain = email.split('@')[1];
  expect(domain).toBeTruthy();
  const token = await page.evaluate(() => localStorage.getItem('basis_token'));
  expect(token).toBeTruthy();

  const api = e2eApiBaseUrl();
  const orgId = await orgIdForUser(page, token!);

  const put = await page.request.put(`${api}/api/v1/orgs/${orgId}/saml`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      idp_entity_id: 'https://idp.example.com/metadata',
      idp_sso_url: 'https://idp.example.com/sso',
      idp_x509_cert: SAMPLE_CERT,
      idp_slo_url: 'https://idp.example.com/slo',
      slo_enabled: true,
      email_domains: [domain],
      enabled: true,
      auth_policy: 'password_allowed',
    },
  });
  expect(put.ok(), `saml upsert failed: ${put.status()} ${await put.text()}`).toBeTruthy();

  const getSaml = await page.request.get(`${api}/api/v1/orgs/${orgId}/saml`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(getSaml.ok()).toBeTruthy();
  const samlBody = (await getSaml.json()) as { slo_url?: string; slo_enabled?: boolean };
  expect(samlBody.slo_enabled).toBe(true);
  expect(samlBody.slo_url).toContain('/api/v1/auth/saml/slo');

  const options = await page.request.get(`${api}/api/v1/auth/org-sso-options`);
  expect(options.ok()).toBeTruthy();
  const samlOpts = ((await options.json()) as { options?: Array<{ protocol?: string }> }).options?.filter(
    (row) => row.protocol === 'saml',
  );
  expect(samlOpts?.length).toBeGreaterThan(0);

  await page.goto('/settings');
  await expect(page.getByTestId('org-oidc-panel')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('org-saml-panel')).toBeVisible();
  await expect(page.getByTestId('org-saml-panel')).toContainText(/SAML|saml/i);
  await expect(page.getByTestId('org-saml-panel')).toContainText(/saml\/slo/i);
});
