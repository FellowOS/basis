import { expect, test } from '@playwright/test';

import {
  defaultWorkspaceId,
  fetchFirstGraphNodeId,
  fetchProvenanceLineage,
  ingestPasteText,
  registerFreshUser,
} from '../helpers';

test('provenance API and lineage workspace after ingest', async ({ page }) => {
  test.setTimeout(180_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await ingestPasteText(page, workspaceId, 'Alice knows Bob.');

  const nodeId = await fetchFirstGraphNodeId(page, workspaceId);
  const lineage = await fetchProvenanceLineage(page, workspaceId, nodeId);
  expect(Array.isArray(lineage.nodes)).toBeTruthy();
  expect(Array.isArray(lineage.edges)).toBeTruthy();

  await page.goto(`/workspaces/${workspaceId}/lineage?node=${encodeURIComponent(nodeId)}`);
  await expect(page.getByRole('button', { name: /^Trace$/i })).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('heading', { name: /工作区不可用|Workspace unavailable/i }),
  ).toHaveCount(0);
  await expect(page.locator('.basis-lineage-shell')).toBeVisible();
});
