import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser } from './helpers';

test('KB integration page loads (MCP, OpenAPI, access tokens); legacy URLs redirect', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.goto(`/kbs/${kbId}/integration`);
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/integration(\\?tab=mcp)?$`), {
    timeout: 60_000,
  });
  await expect(page.getByLabel(/MCP endpoint URL|MCP 端点 URL/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Connect an agent|连接智能体/i)).toBeVisible();

  await page.getByRole('tab', { name: /^OpenAPI$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/integration\\?tab=openapi`), {
    timeout: 30_000,
  });

  await page.getByRole('tab', { name: /Access tokens|访问令牌/i }).click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/integration\\?tab=tokens`), {
    timeout: 30_000,
  });
  await expect(page.getByText(/Shared by MCP and OpenAPI|MCP 与 OpenAPI 共用/i)).toBeVisible();

  await page.getByRole('tab', { name: /^(Access tokens|访问令牌)$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/integration\\?tab=tokens`), {
    timeout: 30_000,
  });
  await expect(page.getByText(/Shared by MCP and OpenAPI|MCP 与 OpenAPI 共用/i)).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/kbs/${kbId}/mcp`);
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/integration\\?tab=mcp`), { timeout: 30_000 });

  await page.goto(`/kbs/${kbId}/chat?tab=connect`);
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/integration\\?tab=mcp`), { timeout: 30_000 });

  await page.goto(`/kbs/${kbId}/chat`);
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/search$`), { timeout: 30_000 });
});
