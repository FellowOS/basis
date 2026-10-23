import { expect, test } from '@playwright/test';

import {
  defaultWorkspaceId,
  fetchTemporalBounds,
  ingestDocumentViaApi,
  registerFreshUser,
} from '../helpers';

test('graph diff page compares projection between bounds', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await ingestDocumentViaApi(page, workspaceId, 'Eve knows Frank.');

  const bounds = await fetchTemporalBounds(page, workspaceId);
  const from = bounds.min ?? '2020-01-01T00:00:00';
  const to = bounds.max ?? '2030-01-01T00:00:00';

  await page.goto(`/workspaces/${workspaceId}/graph-diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  await expect(page.locator('.basis-graph-diff-page')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Compare$|^对比$/ }).click();
  await expect(page.getByText(/nodes|节点/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(new RegExp(`from=${encodeURIComponent(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

  const preview = page.getByTestId('graph-diff-preview-on-graph');
  if ((await preview.count()) > 0) {
    await preview.click();
    await expect(page.locator('[data-testid="workspace-graph-diff-preview-bar"]')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page).toHaveURL(/diff_from=/);
    await expect(page.getByTestId('workspace-graph-diff-overlay-active')).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId('workspace-graph-diff-preview-merge-pick')).toBeVisible({
      timeout: 30_000,
    });
  }
});

test('graph diff range end opens timeline playback on graph', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await ingestDocumentViaApi(page, workspaceId, 'Graph diff timeline link smoke.');

  const bounds = await fetchTemporalBounds(page, workspaceId);
  const from = bounds.min ?? '2020-01-01T00:00:00';
  const to = bounds.max ?? '2030-01-01T00:00:00';

  await page.goto(`/workspaces/${workspaceId}/graph-diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  await expect(page.locator('.basis-graph-diff-page')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Compare$|^对比$/ }).click();

  const timelineLink = page.getByTestId('graph-diff-open-graph-timeline-at-end');
  if ((await timelineLink.count()) === 0) {
    test.skip(true, 'no changes in diff range');
  }
  await timelineLink.click();
  await expect(page).toHaveURL(/timeline=1/);
  await expect(page.locator('.explore-shell[data-timeline="true"]')).toBeVisible({
    timeout: 60_000,
  });
});
