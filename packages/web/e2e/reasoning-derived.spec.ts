import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser, runReasoningApplyViaApi } from './helpers';

test('reasoning apply_to_graph shows derived facts on entities page', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const stamp = `E2eDeriv${Date.now()}`;
  const entityA = `${stamp}A`;
  const entityB = `${stamp}B`;

  try {
    const out = await runReasoningApplyViaApi(
      page,
      kbId,
      [`parent(${entityA}, ${entityB})`],
      [`IF parent(${entityA}, ${entityB}) THEN ancestor(${entityA}, ${entityB})`],
    );
    expect((out.derived_facts_persisted?.created ?? 0) >= 1).toBeTruthy();
  } catch (err) {
    if (String(err).includes('explorer_unavailable')) {
      test.skip(true, 'reasoning/run requires explorer_runtime');
    }
    throw err;
  }

  await page.goto(`/kbs/${kbId}/entities`);
  await page.getByPlaceholder(/Entity label|实体名称/i).fill(entityA);
  await page.getByRole('button', { name: /^Search$|^搜索$/ }).click();
  await expect(page.getByText(entityA).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Facts$|^事实$/ }).first().click();
  await expect(page.getByText(/Derived \(reasoning\)|推理派生/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/urn:sema:pred:ancestor|ancestor/)).toBeVisible();
  await expect(page.getByText(`parent(${entityA}, ${entityB})`)).toBeVisible();
});
