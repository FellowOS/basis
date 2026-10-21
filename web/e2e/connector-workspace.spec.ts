import { expect, test } from '@playwright/test';

import {
  createCustomersTableMappingViaApi,
  postE2eConnectionCheck,
  putE2ePostgresSqliteConnection,
  seedE2eSqliteCustomersDb,
} from './connector-mapping-suggest-fixture.js';
import { defaultKbId, registerFreshUser } from './helpers.js';

test('connector runs panel lists run after connection check', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const connectionName = 'e2e_runs';
  const dbPath = seedE2eSqliteCustomersDb();

  await putE2ePostgresSqliteConnection(page, kbId, connectionName, dbPath);
  await postE2eConnectionCheck(page, kbId, 'postgres', connectionName);

  await page.goto(`/kbs/${kbId}/connectors/runs`);
  await expect(page.getByTestId('connectors-panel-runs')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('postgres', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('check', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/OK|Failed|成功|失败/i).first()).toBeVisible();
});

test('connector mapping edit saves label column and returns to list', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const connectionName = 'e2e_edit';
  const dbPath = seedE2eSqliteCustomersDb();

  await putE2ePostgresSqliteConnection(page, kbId, connectionName, dbPath);
  const mappingId = await createCustomersTableMappingViaApi(page, kbId, connectionName);

  await page.goto(`/kbs/${kbId}/connectors/mappings/${mappingId}/edit`);
  await expect(page.getByTestId('mapping-label-input')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('mapping-label-input').fill('customer_name');
  await page.getByTestId('mapping-target-class-input').fill('urn:basis:class:E2eCustomer');
  await page.getByTestId('submit-table-mapping-btn').click();

  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/connectors/mappings$`), {
    timeout: 30_000,
  });
  await expect(page.getByTestId('connectors-panel-mappings')).toBeVisible();
  await expect(page.getByText('urn:basis:class:E2eCustomer')).toBeVisible();
});

test('connector mappings list sync now runs inbound sync', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const connectionName = 'e2e_sync_ui';
  const dbPath = seedE2eSqliteCustomersDb();

  await putE2ePostgresSqliteConnection(page, kbId, connectionName, dbPath);
  const mappingId = await createCustomersTableMappingViaApi(page, kbId, connectionName);

  await page.goto(`/kbs/${kbId}/connectors/mappings`);
  const syncBtn = page.getByTestId(`sync-mapping-btn-${mappingId}`);
  await expect(syncBtn).toBeVisible({ timeout: 30_000 });
  await syncBtn.click();
  await expect(syncBtn).not.toHaveText(/Syncing|同步中/i, { timeout: 60_000 });
  await expect(page.getByText(/Fetched|拉取/).first()).toBeVisible({ timeout: 30_000 });
});

test('connector oauth callback without session shows error', async ({ page }) => {
  test.setTimeout(60_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.goto(`/kbs/${kbId}/connectors/oauth/callback`);
  await expect(page.getByTestId('connector-oauth-callback')).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/Missing authorization|缺少授权|session|会话/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Back to connector catalog|返回连接器目录/i }),
  ).toBeVisible();
});
