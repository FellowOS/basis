import { expect, test } from '@playwright/test';

import { ensurePlatformAdminSession, gotoPlatformAdminPath } from '../e2e-admin-session.js';

test('platform admin connectors page shows catalog and sidebar navigation', async ({ page }) => {
  test.setTimeout(120_000);

  await ensurePlatformAdminSession(page);
  await gotoPlatformAdminPath(page, '/admin/connectors');
  await expect(page.getByTestId('platform-connectors-catalog-search')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveURL(/\/admin\/connectors/);
  await expect(page.locator('[data-slot=breadcrumb]')).toBeVisible();
  await expect(page.getByRole('link', { name: /administration|管理/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /connectors|连接器/i }).first()).toBeVisible();
});
