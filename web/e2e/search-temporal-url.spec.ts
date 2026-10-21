import { expect, test } from '@playwright/test';

import { defaultWorkspaceId, ingestDocumentViaApi, registerFreshUser } from './helpers';

test('search URL keeps as_of and at for shareable links', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await ingestDocumentViaApi(page, workspaceId, 'Temporal URL smoke document.');

  const asOf = '2030-01-01T00:00:00Z';
  const at = '2030-06-15T12:00:00Z';

  await page.goto(`/workspaces/${workspaceId}/search?scope=chunks&q=smoke&as_of=${encodeURIComponent(asOf)}`);

  await expect(page.getByTestId('workspace-search-as-of')).toHaveValue(asOf, { timeout: 30_000 });

  await page.getByRole('button', { name: /^Search$|^搜索$/ }).click();
  await expect(page).toHaveURL(new RegExp(`as_of=${encodeURIComponent(asOf).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`));

  await page.goto(
    `/workspaces/${workspaceId}/search?scope=graph&q=smoke&at=${encodeURIComponent(at)}`,
  );

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph search requires graph_runtime');
  }

  await expect(page.getByTestId('workspace-search-at')).toHaveValue(at, { timeout: 30_000 });
});
