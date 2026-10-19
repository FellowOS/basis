import { expect, test } from '@playwright/test';

import { registerFreshUser } from './helpers.js';

test('platform admin connectors page shows catalog and sidebar navigation', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);

  await page.goto('/admin/connectors');

  await expect(page.getByRole('navigation', { name: /breadcrumb|面包屑/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('link', { name: /administration|管理/i })).toBeVisible();
  await expect(page.getByTestId('platform-connectors-catalog-search')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('link', { name: /connectors|连接器/i }).first()).toBeVisible();
});
