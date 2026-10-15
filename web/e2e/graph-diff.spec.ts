import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  fetchTemporalBounds,
  ingestDocumentViaApi,
  registerFreshUser,
} from './helpers';

test('graph diff page compares projection between bounds', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Eve knows Frank.');

  const bounds = await fetchTemporalBounds(page, kbId);
  const from = bounds.min ?? '2020-01-01T00:00:00';
  const to = bounds.max ?? '2030-01-01T00:00:00';

  await page.goto(`/kbs/${kbId}/graph-diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  await expect(page.locator('.kb-graph-diff-workspace')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Compare$|^对比$/ }).click();
  await expect(page.getByText(/nodes|节点/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(new RegExp(`from=${encodeURIComponent(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});
