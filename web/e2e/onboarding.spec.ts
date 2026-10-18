import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  ingestPasteText,
  registerFreshUser,
  searchGraphNodes,
} from './helpers';

test('register, open sources, paste text, pattern ingest', async ({ page }) => {
  test.setTimeout(180_000);

  await registerFreshUser(page);
  await expect(page).toHaveURL(/\/kbs/);
  const kbId = await defaultKbId(page);
  const body = 'Alice knows Bob.';
  await ingestPasteText(page, kbId, body);

  const hits = await searchGraphNodes(page, kbId, 'Alice');
  expect(
    hits.some((hit) => {
      const blob = `${hit.node.content ?? ''} ${hit.node.label ?? ''} ${hit.node.id}`;
      return /alice/i.test(blob);
    }),
  ).toBeTruthy();

  await page.goto(`/kbs/${kbId}/graph`);
  await expect(page.getByTestId('kb-graph-workspace')).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole('heading', { name: /工作区不可用|Workspace unavailable/i }),
  ).toHaveCount(0);
});
