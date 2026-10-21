import { expect, test } from '@playwright/test';

import { e2eKbPath } from './api-v1-path.js';
import {
  putE2ePostgresSqliteConnection,
  seedE2eSqliteCustomersDb,
  suggestSqlTableMappings,
} from './connector-mapping-suggest-fixture.js';
import { bearerToken, defaultKbId, registerFreshUser } from './helpers.js';

test('connector table-mapping suggest and batch-create API (SQL discover)', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const token = await bearerToken(page);
  const dbPath = seedE2eSqliteCustomersDb();
  const connectionName = 'e2e_suggest_api';

  await putE2ePostgresSqliteConnection(page, kbId, connectionName, dbPath);

  const suggested = await suggestSqlTableMappings(page, kbId, [
    {
      provider: 'postgres',
      connection_name: connectionName,
      external_table: 'customers',
    },
  ]);
  expect(suggested.groups.length).toBeGreaterThan(0);
  const draft = suggested.groups[0]?.drafts[0]?.draft;
  expect(draft?.external_table).toBe('customers');
  expect(draft?.primary_key_column).toBe('customer_id');
  expect(draft?.target_class_uri).toContain('Customers');

  const batch = await page.request.post(e2eKbPath(kbId, 'connectors/table-mappings/batch-create'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { mappings: [draft], run_sync: true },
  });
  expect(batch.ok(), `batch-create failed: ${batch.status()} ${await batch.text()}`).toBeTruthy();
  const batchBody = (await batch.json()) as { mappings: Array<{ id: string }> };
  expect(batchBody.mappings.length).toBe(1);

  const list = await page.request.get(e2eKbPath(kbId, 'connectors/table-mappings'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(list.ok()).toBeTruthy();
  const mappings = (await list.json()) as { mappings: Array<{ external_table: string }> };
  expect(mappings.mappings.some((m) => m.external_table === 'customers')).toBeTruthy();
});

test('data onboarding wizard: SQL table input → suggest dialog → save and sync', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const dbPath = seedE2eSqliteCustomersDb();
  const connectionName = 'e2e_suggest_wizard';

  await putE2ePostgresSqliteConnection(page, kbId, connectionName, dbPath);

  await page.goto(`/kbs/${kbId}/onboarding/data`);
  await expect(page.getByLabel(/SQL tables|SQL 表/i)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/SQL tables|SQL 表/i).fill('customers');
  await page.getByRole('button', { name: /Suggest mappings|生成映射建议/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText('customers', { exact: true })).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: /Save & sync|保存并同步/i }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: /View connector mappings|查看连接器映射/i })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('link', { name: /View connector mappings|查看连接器映射/i }).click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/connectors/mappings`));
  await expect(page.getByTestId('connectors-panel-mappings')).toBeVisible();
  await expect(
    page.getByTestId('connectors-panel-mappings').getByText('customers', { exact: true }),
  ).toBeVisible();
});

test('connector mappings panel opens cross-stream suggest dialog', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.goto(`/kbs/${kbId}/connectors/mappings`);
  await page.getByTestId('suggest-table-mappings-btn').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /Cross-stream|跨 stream/i })).toBeVisible();
  await dialog.getByRole('button', { name: /Cancel|取消/i }).click();
  await expect(dialog).toBeHidden();
});
