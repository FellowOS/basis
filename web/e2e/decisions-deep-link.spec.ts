import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser } from './helpers';

test('decisions list selection updates shareable decision query', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await page.goto(`/kbs/${kbId}/decisions`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'decisions workspace requires explorer_runtime');
  }

  const firstItem = page.locator('[data-testid^="decision-list-item-"]').first();
  await expect(firstItem).toBeVisible({ timeout: 60_000 });
  const testId = await firstItem.getAttribute('data-testid');
  const decisionId = testId?.replace('decision-list-item-', '');
  expect(decisionId).toBeTruthy();

  await firstItem.click();
  await expect(page).toHaveURL(
    new RegExp(`decision=${encodeURIComponent(decisionId!).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`),
  );
});
