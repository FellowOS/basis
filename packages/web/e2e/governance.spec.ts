import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser } from './helpers';

test('review queue surfaces link to ontology versions tab', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await page.goto(`/kbs/${kbId}/review?tab=queue`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  const ontologyLink = page.getByRole('link', {
    name: /Ontology → Versions|本体 → 版本/i,
  });
  await expect(ontologyLink.first()).toBeVisible({ timeout: 60_000 });
  await ontologyLink.first().click();
  await expect(page).toHaveURL(/ontologyTab=versions/);
});

test('sources query opens ingest connectors dialog', async ({ page }) => {
  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await page.goto(`/kbs/${kbId}/sources?connectors=1`);
  await expect(page.locator('.kb-library-workspace')).toBeVisible({ timeout: 60_000 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText(/Ingest sources|摄入来源/i)).toBeVisible();
});

test('search graph tab shows temporal hint and link to graph workspace', async ({ page }) => {
  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await page.goto(`/kbs/${kbId}/search`);
  await page.getByRole('button', { name: /^Graph$|^图谱节点$/ }).click();

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph search requires explorer_runtime');
  }

  await expect(
    page.getByText(/current projection|当前投影/i),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: /Open in graph|在图谱中打开/i }).click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/graph`));
});
