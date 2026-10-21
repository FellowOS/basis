import { expect, test, type Page } from '@playwright/test';

import { loginPlatformAdmin } from './e2e-admin-session.js';
import { registerFreshUser } from './helpers.js';

async function ensurePlatformAdminSession(page: Page): Promise<{ email: string }> {
  try {
    return await loginPlatformAdmin(page);
  } catch {
    await registerFreshUser(page);
    return await loginPlatformAdmin(page);
  }
}

test('platform users page lists the registering admin', async ({ page }) => {
  test.setTimeout(90_000);

  const { email } = await ensurePlatformAdminSession(page);
  await page.goto('/admin/users');

  await expect(page.getByRole('button', { name: /Create user|创建用户/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(email)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('E2E User').first()).toBeVisible();
});

test('platform kbs page shows catalog table and create action', async ({ page }) => {
  test.setTimeout(90_000);

  await ensurePlatformAdminSession(page);
  await page.goto('/admin/kbs');

  await expect(page).toHaveURL(/\/admin\/kbs/);
  await expect(page.getByRole('button', { name: /New knowledge base|新建知识库/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('columnheader', { name: /Name|名称/i })).toBeVisible();
});

test('platform models page shows LLM tab and add model action', async ({ page }) => {
  test.setTimeout(90_000);

  await ensurePlatformAdminSession(page);
  await page.goto('/admin/models');

  await expect(page).toHaveURL(/\/admin\/models/);
  await expect(page.getByRole('tab', { name: /^LLM$/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Add model|添加模型/i }).first()).toBeVisible();
});

test('platform settings page shows access and org SSO sections', async ({ page }) => {
  test.setTimeout(90_000);

  await ensurePlatformAdminSession(page);
  await page.goto('/admin/settings');

  await expect(page).toHaveURL(/\/admin\/settings/);
  await expect(page.getByRole('heading', { name: /^Login$|^登录$/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole('heading', { name: /Organization SSO|组织 SSO/i }),
  ).toBeVisible();
});

test('platform audit page shows filters and refresh', async ({ page }) => {
  test.setTimeout(90_000);

  await ensurePlatformAdminSession(page);
  await page.goto('/admin/audit');

  await expect(page).toHaveURL(/\/admin\/audit/);
  await expect(page.getByPlaceholder(/Filter by KB ID|按知识库 ID 筛选/i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: /Refresh|刷新/i })).toBeVisible();
});
