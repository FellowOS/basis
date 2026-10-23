import { expect, test } from '@playwright/test';

test('login shell renders email and password fields', async ({ page }) => {
  await page.goto('/?mode=login');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel(/Email|邮箱/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Password|密码/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /登录|Sign in/i })).toBeVisible();
});
