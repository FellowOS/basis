import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser } from './helpers.js';

test('kb settings general and members tabs render', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.goto(`/kbs/${kbId}/settings?tab=general`);
  await expect(page.getByRole('tab', { name: /General|常规|通用/i })).toHaveAttribute(
    'data-state',
    'active',
  );
  await expect(page.getByText(/Visibility|可见性|visibility/i).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('tab', { name: /Members|成员/i }).click();
  await expect(page).toHaveURL(/tab=members/);
  await expect(page.getByRole('tab', { name: /Members|成员/i })).toHaveAttribute(
    'data-state',
    'active',
  );
});

test('kb settings search tab renders reindex control', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.goto(`/kbs/${kbId}/settings?tab=search`);
  await expect(page.getByRole('tab', { name: /Search|检索|搜索/i })).toHaveAttribute(
    'data-state',
    'active',
  );
  await expect(
    page.getByRole('button', { name: /Rebuild vector index|重建向量索引/i }).first(),
  ).toBeVisible({ timeout: 30_000 });
});
