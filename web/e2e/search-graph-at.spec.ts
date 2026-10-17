import { expect, test } from '@playwright/test';

import { defaultKbId, ingestDocumentViaApi, registerFreshUser } from './helpers';

test('search graph tab runs query', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Graph search smoke node.');

  await page.goto(`/kbs/${kbId}/search?tab=graph&q=smoke`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph search requires explorer_runtime');
  }

  await expect(page.getByPlaceholder(/Node id|节点 id/i)).toHaveValue('smoke', { timeout: 30_000 });
  await expect(page.getByText(/result|结果/i).first()).toBeVisible({ timeout: 60_000 });
});
