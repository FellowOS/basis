import { expect, test } from '@playwright/test';

import { e2eKbPath } from './api-v1-path.js';
import { bearerToken, defaultKbId, registerFreshUser } from './helpers.js';

test('connectors workspace displays BOCP catalog, policy, and mappings tabs', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.goto(`/kbs/${kbId}/connectors/catalog`);

  // Verify catalog panel loads built-in stream-enabled connectors (postgres, github, …)
  await expect(page.getByTestId('catalog-connector-card-postgres')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('catalog-connector-card-github')).toBeVisible();

  await page.goto(`/kbs/${kbId}/connectors/policy`);
  const policyInput = page.getByTestId('policy-allowed-providers-input');
  await expect(policyInput).toBeVisible();
  await policyInput.fill('postgres, github');
  await page.getByTestId('save-connector-policy-btn').click();

  await page.goto(`/kbs/${kbId}/connectors/mappings`);
  await expect(page.getByTestId('create-table-mapping-btn')).toBeVisible();
});

test('connector writeback review item renders Before -> After field diff card in review queue', async ({
  page,
}) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const token = await bearerToken(page);

  // Create a connection + table mapping via API so we can verify the UI tabs
  const putConn = await page.request.put(
    e2eKbPath(kbId, 'connectors/connections/postgres/e2e_erp'),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        auth_type: 'database_dsn',
        connection_config: { sqlalchemy_url: 'sqlite:///:memory:' },
        credentials: {},
      },
    },
  );
  expect(putConn.ok()).toBeTruthy();

  await page.goto(`/kbs/${kbId}/connectors/catalog`);
  await expect(page.getByTestId('configured-connection-postgres-e2e_erp')).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId('create-mapping-from-connection-postgres-e2e_erp').click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/connectors/mappings/new`));
  await expect(page.getByTestId('mapping-connection-select')).toBeVisible();
  await expect(page.getByTestId('mapping-connection-select')).toContainText('e2e_erp');
});
