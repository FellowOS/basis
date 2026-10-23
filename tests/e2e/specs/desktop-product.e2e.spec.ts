import { expect, test } from '@playwright/test';

const desktopE2e = process.env.BASIS_E2E_DESKTOP === '1';

test.describe('desktop product (ADR 0004)', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!desktopE2e) {
      testInfo.skip(true, 'set BASIS_E2E_DESKTOP=1');
    }
  });

  test('opens workspace console without login', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/workspaces/, { timeout: 60_000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('redirects cloud-only admin routes to home', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/workspaces/, { timeout: 60_000 });
    await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 60_000 });

    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/);

    await page.goto('/admin/settings');
    await expect(page).not.toHaveURL(/\/admin\/settings/);
  });
});
