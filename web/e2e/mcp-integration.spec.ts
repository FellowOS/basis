import { expect, test } from '@playwright/test';

import { defaultWorkspaceId, registerFreshUser } from './helpers';

test('workspace integration page loads (MCP, OpenAPI, access tokens); tab deep links redirect', async ({ page }) => {
  test.setTimeout(90_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);

  await page.goto(`/workspaces/${workspaceId}/integration`);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/integration(\\?tab=mcp)?$`), {
    timeout: 60_000,
  });
  await expect(page.getByLabel(/MCP endpoint URL|MCP 端点 URL/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Connect an agent|连接智能体/i)).toBeVisible();

  await page.getByRole('tab', { name: /^OpenAPI$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/integration\\?tab=openapi`), {
    timeout: 30_000,
  });
  await expect(page.getByTestId('workspace-integration-export-ui-hint')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('workspace-integration-alerts-api-hint')).toBeVisible();

  await page.getByRole('tab', { name: /Access tokens|访问令牌/i }).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/integration\\?tab=tokens`), {
    timeout: 30_000,
  });
  await expect(page.getByText(/Shared by MCP and OpenAPI|MCP 与 OpenAPI 共用/i)).toBeVisible();

  await page.getByRole('tab', { name: /^(Access tokens|访问令牌)$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/integration\\?tab=tokens`), {
    timeout: 30_000,
  });
  await expect(page.getByText(/Shared by MCP and OpenAPI|MCP 与 OpenAPI 共用/i)).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/workspaces/${workspaceId}/mcp`);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/integration\\?tab=mcp`), { timeout: 30_000 });

  await page.goto(`/workspaces/${workspaceId}/chat?tab=connect`);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/integration\\?tab=mcp`), { timeout: 30_000 });

  await page.goto(`/workspaces/${workspaceId}/chat`);
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}/search$`), { timeout: 30_000 });
});
