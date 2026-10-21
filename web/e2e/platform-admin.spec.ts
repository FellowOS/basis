import { expect, test } from '@playwright/test';

import { loginPlatformAdmin } from './e2e-admin-session.js';
import { registerFreshUser } from './helpers.js';

test('platform users page lists the registering admin', async ({ page }) => {
  test.setTimeout(90_000);

  let email: string;
  try {
    ({ email } = await loginPlatformAdmin(page));
  } catch {
    await registerFreshUser(page);
    ({ email } = await loginPlatformAdmin(page));
  }
  await page.goto('/admin/users');

  await expect(page.getByRole('button', { name: /Create user|创建用户/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(email)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('E2E User').first()).toBeVisible();
});
