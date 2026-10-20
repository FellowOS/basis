import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

const SIDEBAR_PAGES = [
  'Overview',
  'Quickstart',
  'Core concepts',
  'REST API',
  'BOCP',
  'Connectors (Basis)',
  'Authentication',
  'MCP',
  'API reference',
  'Self-host',
];

test('docs sidebar lists every page and routes the connector runtime page', async ({ page }) => {
  await page.goto('/docs');

  const sidebar = page.getByTestId('docs-sidebar');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link')).toHaveText(SIDEBAR_PAGES);
  await expect(sidebar.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await sidebar.getByRole('link', { name: 'Connectors (Basis)' }).click();

  await expect(page).toHaveURL(/\/docs\/connectors-basis$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Basis connector runtime (BOCP host)',
  );
  await expect(
    page.getByTestId('docs-sidebar').getByRole('link', { name: 'Connectors (Basis)' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('docs overview links navigate into the reading path', async ({ page }) => {
  await page.goto('/docs');

  const article = page.locator('[data-doc-article]');
  await expect(article.getByRole('link', { name: 'Connectors (Basis)' })).toHaveAttribute(
    'href',
    '/docs/connectors-basis',
  );

  await article.getByRole('link', { name: 'Quickstart' }).click();

  await expect(page).toHaveURL(/\/docs\/quickstart$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quickstart');
});

test('BOCP pager advances to the connector runtime page', async ({ page }) => {
  await page.goto('/docs/bocp');

  const pager = page.getByRole('navigation', {
    name: 'Previous and next documentation pages',
  });
  await pager.getByRole('link', { name: /Connectors \(Basis\)/ }).click();

  await expect(page).toHaveURL(/\/docs\/connectors-basis$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Basis connector runtime (BOCP host)',
  );
});

test('unknown docs path renders a 404 without redirecting', async ({ page }) => {
  await page.goto('/docs/does-not-exist/extra');

  await expect(page).toHaveURL(/\/docs\/does-not-exist\/extra$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.getByText('/docs/does-not-exist/extra')).toBeVisible();

  await page.getByRole('link', { name: 'Documentation overview' }).click();

  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Basis developer documentation');
});
