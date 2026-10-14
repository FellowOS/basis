import { expect, type Page } from '@playwright/test';

export async function registerFreshUser(page: Page): Promise<{ email: string; password: string }> {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const password = 'password1xy';

  await page.goto('/login?mode=register');
  await page.locator('#display_name').fill('E2E User');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /创建账号|Create account/i }).click();
  await expect(page).toHaveURL(/\/kbs/);

  return { email, password };
}

export async function defaultKbId(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('sema_token'));
  if (!token) {
    throw new Error('Missing sema_token after login');
  }
  const response = await page.request.get('/api/kbs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    kbs?: Array<{ id: string; my_role?: string }>;
  };
  const kbs = body.kbs ?? [];
  const editable =
    kbs.find((kb) => kb.my_role === 'admin' || kb.my_role === 'owner' || kb.my_role === 'editor') ??
    kbs[0];
  if (!editable?.id) {
    throw new Error('Could not resolve default KB id from /api/kbs');
  }
  return editable.id;
}

export async function fetchGraphStats(
  page: Page,
  kbId: string,
): Promise<{ node_count: number; edge_count: number }> {
  const token = await page.evaluate(() => localStorage.getItem('sema_token'));
  if (!token) {
    throw new Error('Missing sema_token after login');
  }
  const response = await page.request.get(`/api/kbs/${kbId}/graph/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { node_count: number; edge_count: number };
}
