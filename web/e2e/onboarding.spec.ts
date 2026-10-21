import { expect, test } from '@playwright/test';

import {
  defaultWorkspaceId,
  ingestPasteText,
  registerFreshUser,
  searchGraphNodes,
} from './helpers';

test('register, open sources, paste text, pattern ingest', async ({ page }) => {
  test.setTimeout(180_000);

  await registerFreshUser(page);
  await expect(page).toHaveURL(/\/workspaces/);
  const workspaceId = await defaultWorkspaceId(page);
  const body = 'Alice knows Bob.';
  await ingestPasteText(page, workspaceId, body);

  const hits = await searchGraphNodes(page, workspaceId, 'Alice');
  expect(
    hits.some((hit) => {
      const blob = `${hit.node.content ?? ''} ${hit.node.label ?? ''} ${hit.node.id}`;
      return /alice/i.test(blob);
    }),
  ).toBeTruthy();

  await page.goto(`/workspaces/${workspaceId}/graph`);
  await expect(page.getByTestId('workspace-graph-canvas')).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole('heading', { name: /工作区不可用|Workspace unavailable/i }),
  ).toHaveCount(0);
});
