import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  fetchTemporalBounds,
  ingestDocumentViaApi,
  registerFreshUser,
} from './helpers';

test('graph at query opens temporal context', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Graph temporal deep link smoke.');

  const bounds = await fetchTemporalBounds(page, kbId);
  const at = bounds.max ?? bounds.min ?? '2030-01-01T00:00:00Z';

  await page.goto(`/kbs/${kbId}/graph?at=${encodeURIComponent(at)}`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph workspace requires explorer_runtime');
  }

  await expect(page.locator('[data-testid="kb-graph-workspace"]')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText('Temporal', { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId('graph-temporal-hint')).toBeVisible({ timeout: 60_000 });
});

test('graph timeline entry deep link opens playback footer', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Graph timeline URL sync smoke.');

  const bounds = await fetchTemporalBounds(page, kbId);
  const at = bounds.max ?? bounds.min ?? '2030-01-01T00:00:00Z';

  await page.goto(`/kbs/${kbId}/graph?at=${encodeURIComponent(at)}`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph workspace requires explorer_runtime');
  }

  await expect(page.locator('[data-testid="kb-graph-workspace"]')).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId('kb-graph-open-timeline').click();
  await expect(page).toHaveURL(/timeline=1/);
  await expect(page).toHaveURL(new RegExp(`at=${encodeURIComponent(at).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`));
  await expect(page.locator('.explore-shell[data-timeline="true"]')).toBeVisible({
    timeout: 60_000,
  });
});

test('search open in graph focuses node', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Search to graph link smoke node.');

  const bounds = await fetchTemporalBounds(page, kbId);
  const at = bounds.max ?? bounds.min ?? '2030-01-01T00:00:00Z';
  await page.goto(
    `/kbs/${kbId}/search?tab=graph&q=smoke&at=${encodeURIComponent(at)}`,
  );

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph search requires explorer_runtime');
  }

  await expect(page.getByText(/result|结果/i).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('link', { name: /Open in graph|在图谱中打开/i }).first().click();
  await expect(page.locator('[data-testid="kb-graph-workspace"]')).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveURL(new RegExp(`at=${encodeURIComponent(at).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`));
});
