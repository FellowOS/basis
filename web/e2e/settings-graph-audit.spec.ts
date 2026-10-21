import { expect, test } from '@playwright/test';

import { e2eApiBaseUrl } from './api-v1-path.js';
import {
  bearerToken,
  defaultKbId,
  rebuildGraphProjectionViaApi,
  registerFreshUser,
  skipUnlessKbGraphWrite,
} from './helpers';

test('kb settings graph tab links recent audit to review queue', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await skipUnlessKbGraphWrite(page, kbId);
  await rebuildGraphProjectionViaApi(page, kbId);

  const token = await bearerToken(page);
  const meRes = await page.request.get(`${e2eApiBaseUrl()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(meRes.ok()).toBeTruthy();
  const isAdmin = Boolean(
    ((await meRes.json()) as { user?: { is_admin?: boolean } }).user?.is_admin,
  );

  await page.goto(`/kbs/${kbId}/settings?tab=graph`);

  await expect(page.getByTestId('kb-settings-export-graph')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('kb-settings-export-api-hint')).toBeVisible();

  await expect(page.getByTestId('graph-audit-open-review')).toBeVisible({ timeout: 60_000 });
  if (isAdmin) {
    await expect(page.getByTestId('graph-audit-open-platform-audit')).toBeVisible();
    await page.getByTestId('graph-audit-open-platform-audit').click();
    await expect(page).toHaveURL(new RegExp(`/admin/audit\\?.*kb_id=${kbId}`));
    await page.goto(`/kbs/${kbId}/settings?tab=graph`);
  }
  await page.getByTestId('graph-audit-open-review').click();
  await expect(page).toHaveURL(/\/review/);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }
});
