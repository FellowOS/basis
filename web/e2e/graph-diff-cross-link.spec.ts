import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser, skipUnlessKbGraphWrite } from './helpers';

test('graph toolbar links to graph diff workspace', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await skipUnlessKbGraphWrite(page, kbId);

  await page.goto(`/kbs/${kbId}/graph`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph workspace requires explorer_runtime');
  }

  const diffLink = page.getByTestId('kb-graph-open-diff');
  await expect(diffLink).toBeVisible({ timeout: 60_000 });
  await diffLink.click();
  await expect(page).toHaveURL(/graph-diff/);
  await expect(page.locator('.kb-graph-diff-workspace')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('graph-diff-temporal-hint')).toBeVisible({ timeout: 30_000 });
});
