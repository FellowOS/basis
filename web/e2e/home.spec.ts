import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

test('landing nav scrolls to the capabilities section', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ontology-driven');
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

test('landing self-host section links to the deployment guide', async ({ page }) => {
  await page.goto('/');

  await page.locator('header').getByRole('link', { name: 'Self-Host' }).click();

  await expect(page).toHaveURL(/\/#self-host$/);
  await expect(
    page.locator('#self-host').getByRole('link', { name: 'Deployment guide' }),
  ).toHaveAttribute('href', '/docs/deployment');
  await expect(
    page.locator('#self-host').getByRole('link', { name: 'Quickstart' }),
  ).toHaveAttribute('href', '/docs/quickstart');
});

test('legacy login route opens the auth dialog on the landing page', async ({ page }) => {
  await page.goto('/login?mode=register');

  await expect(page).toHaveURL(/\?mode=register$/);
  await expect(page.getByRole('dialog')).toBeVisible();
});
