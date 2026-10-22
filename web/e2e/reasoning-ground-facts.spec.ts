import { expect, test } from '@playwright/test';

import { e2eWorkspaceApiPath } from './api-v1-path.js';
import {
  bearerToken,
  createWorkspaceWithDemoImport,
  registerFreshUser,
  runReasoningViaApi,
} from './helpers';

test('reasoning run without facts uses typed_facts on demo workspace', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  let workspaceId: string;
  try {
    workspaceId = await createWorkspaceWithDemoImport(page);
  } catch (err) {
    if (String(err).includes('demo_workspace_import_disabled')) {
      test.skip(true, 'import_demo_data not enabled on API');
    }
    throw err;
  }

  const token = await bearerToken(page);
  const rulesResp = await page.request.get(
    `${e2eWorkspaceApiPath(workspaceId, 'rules')}?limit=20`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(rulesResp.ok()).toBeTruthy();
  const rulesBody = (await rulesResp.json()) as { rules?: Array<{ body: string }> };
  const rule = rulesBody.rules?.find((r) => r.body.includes('renewalOrderSignatory'));
  expect(rule?.body).toBeTruthy();

  try {
    const out = await runReasoningViaApi(page, workspaceId, {
      rules: [rule!.body],
      applyToGraph: false,
    });
    expect(out.facts_source).toBe('typed_facts');
    const inferred = out.inferred_facts ?? [];
    expect(inferred.some((f) => f.includes('renewalOrderSignatory'))).toBeTruthy();
  } catch (err) {
    if (String(err).includes('graph_runtime_unavailable')) {
      test.skip(true, 'reasoning/run requires graph_runtime');
    }
    throw err;
  }
});

test('demo workspace auto-loads ontology facts on reasoning tab', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  let workspaceId: string;
  try {
    workspaceId = await createWorkspaceWithDemoImport(page);
  } catch (err) {
    if (String(err).includes('demo_workspace_import_disabled')) {
      test.skip(true, 'import_demo_data not enabled on API');
    }
    throw err;
  }

  await page.goto(`/workspaces/${workspaceId}/analyze?tab=reasoning`);
  const factsField = page.getByRole('textbox', { name: 'Facts' });
  await expect(factsField).toHaveValue(/activeAgreement|implementationContact/, { timeout: 30_000 });
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue(/renewalOrderSignatory/, {
    timeout: 30_000,
  });
});
