import { expect, test } from '@playwright/test';

import { e2eApiBaseUrl } from './api-v1-path.js';
import {
  bearerToken,
  defaultWorkspaceId,
  rebuildGraphProjectionViaApi,
  registerFreshUser,
  skipUnlessWorkspaceGraphWrite,
} from './helpers';

test('workspace settings graph tab links recent audit to review queue', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await skipUnlessWorkspaceGraphWrite(page, workspaceId);
  await rebuildGraphProjectionViaApi(page, workspaceId);

  const token = await bearerToken(page);
  const meRes = await page.request.get(`${e2eApiBaseUrl()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(meRes.ok()).toBeTruthy();
  const isAdmin = Boolean(
    ((await meRes.json()) as { user?: { is_admin?: boolean } }).user?.is_admin,
  );

  await page.goto(`/workspaces/${workspaceId}/settings?tab=graph`);

  await expect(page.getByTestId('workspace-settings-export-graph')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('workspace-settings-export-api-hint')).toBeVisible();

  await expect(page.getByTestId('graph-audit-open-review')).toBeVisible({ timeout: 60_000 });
  if (isAdmin) {
    await expect(page.getByTestId('graph-audit-open-platform-audit')).toBeVisible();
    await page.getByTestId('graph-audit-open-platform-audit').click();
    await expect(page).toHaveURL(new RegExp(`/admin/audit\\?.*workspace_id=${workspaceId}`));
    await page.goto(`/workspaces/${workspaceId}/settings?tab=graph`);
  }
  await page.getByTestId('graph-audit-open-review').click();
  await expect(page).toHaveURL(/\/review/);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires graph_runtime');
  }
});
