import { expect, test } from '@playwright/test';

import {
  createCustomersTableMappingViaApi,
  PLAYWRIGHT_E2E_OAUTH_CODE,
  postE2eConnectionCheck,
  putE2eGithubOAuthConfig,
  putE2ePostgresSqliteConnection,
  seedE2eSqliteCustomersDb,
} from './connector-mapping-suggest-fixture.js';
import { defaultWorkspaceId, registerFreshUser } from './helpers.js';

test('connector runs panel lists run after connection check', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  const dbPath = seedE2eSqliteCustomersDb();

  await putE2ePostgresSqliteConnection(page, workspaceId, dbPath);
  await postE2eConnectionCheck(page, workspaceId, 'postgres');

  await page.goto(`/workspaces/${workspaceId}/connectors/runs`);
  await expect(page.getByTestId('connectors-panel-runs')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('postgres', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('check', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/OK|Failed|成功|失败/i).first()).toBeVisible();
});

test('connector mapping edit saves label column and returns to list', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  const dbPath = seedE2eSqliteCustomersDb();

  await putE2ePostgresSqliteConnection(page, workspaceId, dbPath);
  const mappingId = await createCustomersTableMappingViaApi(page, workspaceId);

  await page.goto(`/workspaces/${workspaceId}/connectors/mappings/${mappingId}/edit`);
  await expect(page.getByTestId('mapping-label-input')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('mapping-label-input').fill('customer_name');
  await page.getByTestId('mapping-target-class-input').fill('urn:basis:class:E2eCustomer');
  await page.getByTestId('submit-table-mapping-btn').click();

  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/connectors/mappings$`), {
    timeout: 30_000,
  });
  await expect(page.getByTestId('connectors-panel-mappings')).toBeVisible();
  await expect(page.getByText('urn:basis:class:E2eCustomer')).toBeVisible();
});

test('connector mappings list sync now runs inbound sync', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  const dbPath = seedE2eSqliteCustomersDb();

  await putE2ePostgresSqliteConnection(page, workspaceId, dbPath);
  const mappingId = await createCustomersTableMappingViaApi(page, workspaceId);

  await page.goto(`/workspaces/${workspaceId}/connectors/mappings`);
  const syncBtn = page.getByTestId(`sync-mapping-btn-${mappingId}`);
  await expect(syncBtn).toBeVisible({ timeout: 30_000 });
  await syncBtn.click();
  await expect(syncBtn).not.toHaveText(/Syncing|同步中/i, { timeout: 60_000 });
  await expect(page.getByText(/Fetched|拉取/).first()).toBeVisible({ timeout: 30_000 });
});

test('connector oauth callback exchanges code and returns to catalog', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  const state = 'e2e-oauth-state-ok';

  await page.goto(`/workspaces/${workspaceId}/connectors`);
  await page.evaluate(
    ({ workspaceId: kid, state: oauthState }) => {
      const redirectUri = `${window.location.origin}/workspaces/${kid}/connectors/oauth/callback`;
      sessionStorage.setItem(
        'basis_bocp_oauth_pending',
        JSON.stringify({
          workspaceId: kid,
          service: 'github',
          connectionConfig: {},
          state: oauthState,
          redirectUri,
        }),
      );
    },
    { workspaceId, state },
  );

  await page.route(`**/api/v1/workspaces/${workspaceId}/connectors/oauth/github/exchange`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connection: {
          service: 'github',
          auth_type: 'oauth2',
        },
      }),
    });
  });

  const exchangeRequest = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      req.url().includes(`/workspaces/${workspaceId}/connectors/oauth/github/exchange`),
  );
  await page.goto(`/workspaces/${workspaceId}/connectors/oauth/callback?code=e2e-fake-code&state=${state}`);
  const exchangeBody = (await exchangeRequest).postDataJSON() as Record<string, unknown>;
  expect(exchangeBody.code).toBe('e2e-fake-code');
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/connectors`), {
    timeout: 30_000,
  });
  await expect(page.getByTestId('connectors-panel-catalog')).toBeVisible({ timeout: 30_000 });
});

test('connector oauth callback exchanges via API playwright stub', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  const state = 'e2e-oauth-state-stub';

  await page.goto(`/workspaces/${workspaceId}/connectors`);
  const redirectUri = await page.evaluate(
    (wid) => `${window.location.origin}/workspaces/${wid}/connectors/oauth/callback`,
    workspaceId,
  );
  await putE2eGithubOAuthConfig(page, workspaceId, redirectUri);
  await page.evaluate(
    ({ workspaceId: wid, state: oauthState, redirectUri: redir }) => {
      sessionStorage.setItem(
        'basis_bocp_oauth_pending',
        JSON.stringify({
          workspaceId: wid,
          service: 'github',
          connectionConfig: {},
          state: oauthState,
          redirectUri: redir,
        }),
      );
    },
    { workspaceId, state, redirectUri },
  );

  const exchangeRequest = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      req.url().includes(`/workspaces/${workspaceId}/connectors/oauth/github/exchange`),
  );
  await page.goto(
    `/workspaces/${workspaceId}/connectors/oauth/callback?code=${PLAYWRIGHT_E2E_OAUTH_CODE}&state=${state}`,
  );
  const exchangeBody = (await exchangeRequest).postDataJSON() as Record<string, unknown>;
  expect(exchangeBody.code).toBe(PLAYWRIGHT_E2E_OAUTH_CODE);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/connectors`), {
    timeout: 30_000,
  });
  await expect(page.getByTestId('connectors-panel-catalog')).toBeVisible({ timeout: 30_000 });
});

test('connector oauth callback without session shows error', async ({ page }) => {
  test.setTimeout(60_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/connectors/oauth/callback`);
  await expect(page.getByTestId('connector-oauth-callback')).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/Missing authorization|缺少授权|session|会话/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Back to connector catalog|返回连接器目录/i }),
  ).toBeVisible();
});
