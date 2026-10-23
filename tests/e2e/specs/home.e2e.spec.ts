import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

test('landing nav scrolls to the capabilities section', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Give AI agents');
  await page.locator('header').getByRole('link', { name: 'Capabilities' }).click();

  await expect(page).toHaveURL(/\/#capabilities$/);
  await expect
    .poll(() =>
      page
        .locator('#capabilities')
        .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(120);
  await expect(page.locator('#capabilities').getByRole('heading', { level: 2 })).toBeVisible();
});

test('landing how-it-works section shows the product preview and FAQ expands', async ({ page }) => {
  await page.goto('/');

  await page.locator('header').getByRole('link', { name: 'How it works' }).click();

  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(page.locator('#how-it-works').getByRole('heading', { level: 2 })).toBeVisible();
  await expect(page.locator('#how-it-works figure')).toBeVisible();

  await page.locator('#faq button').first().click();
  await expect(page.locator('#faq').getByText('Yes — Apache-2.0')).toBeVisible();
});

test('landing self-host section links to the deployment guide', async ({ page }) => {
  await page.goto('/');

  await page.locator('header').getByRole('link', { name: /self-host/i }).click();

  await expect(page).toHaveURL(/\/#self-host$/);
  await expect(
    page.locator('#self-host').getByRole('link', { name: 'Deployment guide' }),
  ).toHaveAttribute('href', '/docs/deployment');
  await expect(
    page.locator('#self-host').getByRole('link', { name: 'Quickstart' }),
  ).toHaveAttribute('href', '/docs/quickstart');
});

test('header Get started opens the registration dialog', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Get started' }).click();

  await expect(page).toHaveURL(/\?mode=register$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading').first()).toContainText('Create');
});

test('legacy login route opens the auth dialog on the landing page', async ({ page }) => {
  await page.goto('/login?mode=register');

  await expect(page).toHaveURL(/\?mode=register$/);
  await expect(page.getByRole('dialog')).toBeVisible();
});
