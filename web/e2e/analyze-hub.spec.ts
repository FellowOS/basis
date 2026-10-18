import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser } from './helpers';

test('analyze hub tabs and legacy SPARQL/reasoning routes redirect', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.goto(`/kbs/${kbId}/analyze`);
  await expect(page.getByRole('tab', { name: /^SPARQL$/i })).toHaveAttribute('data-state', 'active');
  await expect(page.getByText(/SPARQL and reasoning HTTP|SPARQL 与规则推理 HTTP/i)).toBeVisible({
    timeout: 60_000,
  });

  await page.goto(`/kbs/${kbId}/sparql`);
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/analyze$`), { timeout: 30_000 });

  await page.goto(`/kbs/${kbId}/reasoning`);
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/analyze\\?tab=reasoning`), {
    timeout: 30_000,
  });

  await page.getByRole('tab', { name: /Reasoning|规则推理/i }).click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/analyze\\?tab=reasoning`), {
    timeout: 30_000,
  });

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'reasoning workspace requires explorer_runtime');
  }

  await expect(page.getByRole('button', { name: /Run reasoning|运行推理/i })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: /Run reasoning|运行推理/i }).click();
  await expect(page.getByText(/^Results$|^结果$/i).first()).toBeVisible({ timeout: 60_000 });
});
