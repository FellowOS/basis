import { expect, test } from '@playwright/test';

test('login shell renders email and password fields', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.getByRole('button', { name: /登录|Sign in/i })).toBeVisible();
});
