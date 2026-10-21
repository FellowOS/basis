import { expect, test } from '@playwright/test';

import { defaultWorkspaceId, registerFreshUser, seedOntologyProposalViaApi, skipUnlessWorkspaceGraphWrite } from './helpers';

test('ontology versions deep link highlights proposal from URL', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const workspaceId = await defaultWorkspaceId(page);
  await skipUnlessWorkspaceGraphWrite(page, workspaceId);

  let proposalId: string;
  let summary: string;
  try {
    ({ proposalId, summary } = await seedOntologyProposalViaApi(page, workspaceId));
  } catch (err) {
    if (err instanceof Error && err.message === 'e2e_ontology_proposal_unavailable') {
      test.skip(true, 'ontology proposal e2e helper requires data-e2e server');
    }
    throw err;
  }

  await page.goto(
    `/workspaces/${workspaceId}/ontology?tab=versions&ontologyProposal=${encodeURIComponent(proposalId)}`,
  );

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'ontology versions workspace requires graph_runtime');
  }

  const row = page.getByTestId(`ontology-proposal-list-item-${proposalId}`);
  await expect(row).toBeVisible({ timeout: 60_000 });
  await expect(row).toHaveClass(/ring-primary/);
  if (summary) {
    await expect(row.getByText(summary)).toBeVisible();
  }

  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ontology-proposal-copy-link')).toBeVisible();
});
