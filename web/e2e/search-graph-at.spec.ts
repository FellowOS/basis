import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  fetchTemporalBounds,
  ingestDocumentViaApi,
  registerFreshUser,
} from './helpers';

test('search graph tab accepts as_of and runs search', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Graph search temporal smoke node.');

  const bounds = await fetchTemporalBounds(page, kbId);
  const asOf = bounds.max ?? bounds.min ?? '2030-01-01T00:00:00';

  const deepLink = `/kbs/${kbId}/search?tab=graph&q=smoke&as_of=${encodeURIComponent(asOf)}`;
  await page.goto(deepLink);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph search requires explorer_runtime');
  }

  await expect(
    page.getByText(/as_of|截至时刻|active at that instant|该时点仍活跃/i),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder(/Node id|节点 id/i)).toHaveValue('smoke', { timeout: 30_000 });
  await expect(page.getByText(/result|结果/i).first()).toBeVisible({ timeout: 60_000 });
});
