import { expect, test } from '@playwright/test';

import { e2eWorkspaceApiPath } from './api-v1-path.js';
import {
  batchCreateTableMappings,
  putE2eGithubApiKeyConnection,
  putE2ePostgresSqliteConnection,
  seedE2eSqliteCustomersDb,
  suggestAutoTableMappings,
  suggestSqlTableMappings,
} from './connector-mapping-suggest-fixture.js';
import { bearerToken, defaultWorkspaceId, registerFreshUser } from './helpers.js';

test('connector table-mapping suggest and batch-create API (SQL discover)', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  const token = await bearerToken(page);
  const dbPath = seedE2eSqliteCustomersDb();
  await putE2ePostgresSqliteConnection(page, workspaceId, dbPath);

  const suggested = await suggestSqlTableMappings(page, workspaceId, [
    {
      provider: 'postgres',
      external_table: 'customers',
    },
  ]);
  expect(suggested.groups.length).toBeGreaterThan(0);
  const draft = suggested.groups[0]?.drafts[0]?.draft;
  expect(draft?.external_table).toBe('customers');
  expect(draft?.primary_key_column).toBe('customer_id');
  expect(draft?.target_class_uri).toContain('Customers');

  const batch = await page.request.post(e2eWorkspaceApiPath(workspaceId, 'connectors/table-mappings/batch-create'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { mappings: [draft], run_sync: true },
  });
  expect(batch.ok(), `batch-create failed: ${batch.status()} ${await batch.text()}`).toBeTruthy();
  const batchBody = (await batch.json()) as { mappings: Array<{ id: string }> };
  expect(batchBody.mappings.length).toBe(1);

  const list = await page.request.get(e2eWorkspaceApiPath(workspaceId, 'connectors/table-mappings'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(list.ok()).toBeTruthy();
  const mappings = (await list.json()) as { mappings: Array<{ external_table: string }> };
  expect(mappings.mappings.some((m) => m.external_table === 'customers')).toBeTruthy();
});

test('connector mappings suggest: SQL table input → save and sync', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  const dbPath = seedE2eSqliteCustomersDb();
  await putE2ePostgresSqliteConnection(page, workspaceId, dbPath);

  await page.goto(`/workspaces/${workspaceId}/connectors/mappings?suggest=1`);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByTestId('suggest-connection-select')).toBeVisible({ timeout: 30_000 });
  await dialog.getByLabel(/SQL tables|SQL 表/i).fill('customers');
  await dialog.getByTestId('suggest-generate-btn').click();
  await expect(dialog.getByText('customers', { exact: true })).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: /Save & sync|保存并同步/i }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/connectors/mappings`));
  await expect(page.getByTestId('connectors-panel-mappings')).toBeVisible();
  await expect(
    page.getByTestId('connectors-panel-mappings').getByText('customers', { exact: true }),
  ).toBeVisible();
});

test('connector suggest auto-expand hits REST streams (skipped or grouped)', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await putE2eGithubApiKeyConnection(page, workspaceId, 'invalid-e2e-pat');

  const { groups, skipped } = await suggestAutoTableMappings(page, workspaceId);
  expect(groups.length + skipped.length).toBeGreaterThan(0);
});

test('connector suggest auto-expand with live GitHub token', async ({ page }) => {
  test.setTimeout(180_000);

  const livePat = process.env.BASIS_E2E_GITHUB_TOKEN?.trim();
  if (!livePat) {
    test.skip(true, 'set BASIS_E2E_GITHUB_TOKEN for live REST discover');
  }

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await putE2eGithubApiKeyConnection(page, workspaceId, livePat!);

  const { groups } = await suggestAutoTableMappings(page, workspaceId);
  expect(groups.length).toBeGreaterThan(0);
  const draft = groups[0]?.drafts[0]?.draft;
  expect(draft?.provider).toBe('github');
  expect(draft?.stream_name).toBeTruthy();

  const { mappings: created } = await batchCreateTableMappings(page, workspaceId, [draft!], {
    runSync: false,
  });
  expect(created.length).toBe(1);
  expect(created[0]?.id).toBeTruthy();

  const token = await bearerToken(page);
  const list = await page.request.get(e2eWorkspaceApiPath(workspaceId, 'connectors/table-mappings'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(list.ok()).toBeTruthy();
  const mappings = (await list.json()) as {
    mappings: Array<{ id: string; external_table: string; provider?: string }>;
  };
  expect(mappings.mappings.some((m) => m.id === created[0]?.id)).toBeTruthy();
  expect(mappings.mappings.some((m) => m.provider === 'github')).toBeTruthy();
});

test('connector live GitHub batch-create runs inbound sync', async ({ page }) => {
  test.setTimeout(300_000);

  const livePat = process.env.BASIS_E2E_GITHUB_TOKEN?.trim();
  if (!livePat || process.env.BASIS_E2E_GITHUB_RUN_SYNC !== '1') {
    test.skip(
      true,
      'set BASIS_E2E_GITHUB_TOKEN and BASIS_E2E_GITHUB_RUN_SYNC=1 for live inbound sync',
    );
  }

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await putE2eGithubApiKeyConnection(page, workspaceId, livePat!);

  const { groups } = await suggestAutoTableMappings(page, workspaceId);
  const rawDraft = groups.find((g) =>
    g.drafts.some((d) => (d.draft as { stream_name?: string }).stream_name === 'repositories'),
  )?.drafts[0]?.draft;
  const draft = rawDraft
    ? { ...rawDraft, max_rows: 5 }
    : { ...groups[0]!.drafts[0]!.draft, max_rows: 5 };

  const { mappings: created, syncResults } = await batchCreateTableMappings(page, workspaceId, [draft], {
    runSync: true,
  });
  expect(created.length).toBe(1);
  expect(syncResults.length).toBe(1);
  const sync = syncResults[0]!;
  expect(sync.error, `sync failed: ${sync.error}`).toBeUndefined();
  expect((sync.fetched_rows ?? 0) + (sync.added ?? 0) + (sync.updated ?? 0)).toBeGreaterThan(0);
});

test('connector mappings panel live REST suggest shows drafts', async ({ page }) => {
  test.setTimeout(180_000);

  const livePat = process.env.BASIS_E2E_GITHUB_TOKEN?.trim();
  if (!livePat) {
    test.skip(true, 'set BASIS_E2E_GITHUB_TOKEN for live REST discover');
  }

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await putE2eGithubApiKeyConnection(page, workspaceId, livePat!);

  await page.goto(`/workspaces/${workspaceId}/connectors/mappings`);
  await page.getByTestId('create-table-mapping-btn').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByTestId('suggest-generate-btn').click();
  await expect(dialog.locator('label').filter({ has: page.locator('input[type="checkbox"]') }).first()).toBeVisible({
    timeout: 120_000,
  });
  await dialog.getByRole('button', { name: /Cancel|取消/i }).click();
  await expect(dialog).toBeHidden();
});

test('connector mappings panel REST suggest loads drafts without SQL hints', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await putE2eGithubApiKeyConnection(page, workspaceId, 'invalid-e2e-pat');

  await page.route(`**/api/v1/workspaces/${workspaceId}/connectors/table-mappings/suggest`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = (route.request().postDataJSON() ?? {}) as {
      sql_tables?: unknown[];
      connections?: Array<{ provider: string }>;
    };
    expect(body.sql_tables ?? []).toHaveLength(0);
    expect(body.connections).toEqual([{ provider: 'github' }]);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        groups: [
          {
            id: 'issues',
            label: 'Issues',
            drafts: [
              {
                source_label: 'github · issues',
                confidence: 'high',
                entity_group_label: 'Issues',
                draft: {
                  provider: 'github',
                  stream_name: 'issues',
                  external_table: 'issues',
                  primary_key_column: 'id',
                  label_column: 'title',
                  target_class_uri: 'urn:basis:class:Issues',
                  column_mappings: [],
                  sync_mode: 'incremental',
                  track_deletes: false,
                  sync_direction: 'inbound',
                  writeback_mode: 'none',
                  max_rows: 1000,
                  poll_interval_minutes: 60,
                },
              },
            ],
          },
        ],
        skipped: [],
      }),
    });
  });

  await page.goto(`/workspaces/${workspaceId}/connectors/mappings`);
  await page.getByTestId('create-table-mapping-btn').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByTestId('suggest-generate-btn').click();
  await expect(dialog.getByText('issues', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText('urn:basis:class:Issues')).toBeVisible();
  await dialog.getByRole('button', { name: /Cancel|取消/i }).click();
  await expect(dialog).toBeHidden();
});

test('connector mappings panel opens cross-stream suggest dialog', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/connectors/mappings`);
  await page.getByTestId('create-table-mapping-btn').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /New connector mapping|新建连接器映射/i })).toBeVisible();
  await dialog.getByRole('button', { name: /Cancel|取消/i }).click();
  await expect(dialog).toBeHidden();
});
