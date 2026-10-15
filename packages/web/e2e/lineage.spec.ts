import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  fetchFirstGraphNodeId,
  fetchProvenanceLineage,
  ingestPasteText,
  registerFreshUser,
} from './helpers';

test('provenance API and lineage workspace after ingest', async ({ page }) => {
  test.setTimeout(180_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestPasteText(page, kbId, 'Alice knows Bob.');

  const nodeId = await fetchFirstGraphNodeId(page, kbId);
  const lineage = await fetchProvenanceLineage(page, kbId, nodeId);
  expect(Array.isArray(lineage.nodes)).toBeTruthy();
  expect(Array.isArray(lineage.edges)).toBeTruthy();

  await page.goto(`/kbs/${kbId}/lineage?node=${encodeURIComponent(nodeId)}`);
  await expect(page.getByRole('button', { name: /^Trace$/i })).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('heading', { name: /工作区不可用|Workspace unavailable/i }),
  ).toHaveCount(0);
  await expect(page.locator('.kb-lineage-workspace')).toBeVisible();
});
