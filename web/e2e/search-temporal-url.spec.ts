import { expect, test } from '@playwright/test';

import { defaultKbId, ingestDocumentViaApi, registerFreshUser } from './helpers';

test('search URL keeps as_of and at for shareable links', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Temporal URL smoke document.');

  const asOf = '2030-01-01T00:00:00Z';
  const at = '2030-06-15T12:00:00Z';

  await page.goto(`/kbs/${kbId}/search?scope=chunks&q=smoke&as_of=${encodeURIComponent(asOf)}`);

  const timelineEntry = page.getByTestId('kb-search-open-graph-timeline-entry');
  if ((await timelineEntry.count()) > 0) {
    await timelineEntry.click();
    await expect(page).toHaveURL(/timeline=1/);
    await page.goBack();
  }

  await expect(page.getByTestId('kb-search-as-of')).toHaveValue(asOf, { timeout: 30_000 });

  const graphTimeline = page.getByTestId('kb-search-open-graph-timeline');
  if ((await graphTimeline.count()) > 0) {
    await graphTimeline.click();
    await expect(page).toHaveURL(/timeline=1/);
    await expect(page).toHaveURL(new RegExp(`[?&]at=${encodeURIComponent(asOf).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`));
    await page.goBack();
  }

  await page.getByRole('button', { name: /^Search$|^搜索$/ }).click();
  await expect(page).toHaveURL(new RegExp(`as_of=${encodeURIComponent(asOf).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`));

  await page.goto(
    `/kbs/${kbId}/search?scope=graph&q=smoke&at=${encodeURIComponent(at)}`,
  );

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph search requires explorer_runtime');
  }

  await expect(page.getByTestId('kb-search-at')).toHaveValue(at, { timeout: 30_000 });
});
