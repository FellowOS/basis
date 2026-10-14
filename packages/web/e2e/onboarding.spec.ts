import { expect, test } from '@playwright/test';

import { defaultKbId, fetchGraphStats, registerFreshUser } from './helpers';

test('register, open sources, paste text, pattern ingest', async ({ page }) => {
  test.setTimeout(180_000);

  await registerFreshUser(page);
  await expect(page.locator('#kb-name')).toBeVisible();
  const kbId = await defaultKbId(page);
  const body = 'Alice knows Bob.';

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/capabilities') &&
        response.request().method() === 'GET' &&
        response.ok(),
    ),
    page.goto(`/kbs/${kbId}/sources`),
  ]);
  const workspace = page.locator('.kb-library-workspace');
  const addDoc = workspace.getByRole('button', { name: /添加文档|Add document/i }).first();
  await expect(addDoc).toBeVisible({ timeout: 60_000 });
  await addDoc.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: /粘贴文本|Paste text/i }).click();
  await dialog.locator('#add-text').fill(body);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /^保存$|^Save$/i }).click();

  await expect(page.getByText(body, { exact: false })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/就绪|Ready/i).first()).toBeVisible({ timeout: 90_000 });

  const stats = await fetchGraphStats(page, kbId);
  expect(stats.node_count).toBeGreaterThan(0);

  await page.goto(`/kbs/${kbId}/graph`);
  await expect(page.locator('.kb-graph-workspace')).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole('heading', { name: /工作区不可用|Workspace unavailable/i }),
  ).toHaveCount(0);
});
