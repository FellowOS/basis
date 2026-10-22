import { expect, test } from '@playwright/test';

import { defaultWorkspaceId, registerFreshUser } from './helpers.js';

test('statement mappings page shows extraction-focused chrome', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/mappings`);
  await expect(
    page.getByText(/Ontology statement mappings|本体抽取映射/i).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/Connector table mappings|连接器表映射/i).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /New mapping|新建映射/i })).toBeVisible();
});

test('entity resolution workspace loads', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/entity-resolution`);
  await expect(
    page.getByText(/Entity resolution|实体解析/i).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole('button', { name: /[Dd]edup|去重|重复/i }).first(),
  ).toBeVisible({ timeout: 60_000 });
});

test('vocabulary hub loads', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/vocabulary`);
  await expect(page.getByText(/Vocabulary|受控词表|词表/i).first()).toBeVisible({
    timeout: 30_000,
  });
});

test('legacy SHACL route opens ontology hub SHACL tab', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/shacl`);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/ontology\\?tab=shacl`), {
    timeout: 30_000,
  });
  await expect(page.getByRole('tab', { name: /^SHACL$/i })).toHaveAttribute('data-state', 'active');
});

test('legacy alignments route opens ontology hub alignments tab', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/alignments`);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/ontology\\?tab=alignments`), {
    timeout: 30_000,
  });
  await expect(page.getByRole('tab', { name: /Alignments|对齐/i })).toHaveAttribute(
    'data-state',
    'active',
  );
});
