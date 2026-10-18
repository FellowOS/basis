import { expect, test } from '@playwright/test';

import { defaultKbId, registerFreshUser, seedOntologyProposalViaApi, skipUnlessKbGraphWrite } from './helpers';

test('ontology versions deep link highlights proposal from URL', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await skipUnlessKbGraphWrite(page, kbId);

  let proposalId: string;
  let summary: string;
  try {
    ({ proposalId, summary } = await seedOntologyProposalViaApi(page, kbId));
  } catch (err) {
    if (err instanceof Error && err.message === 'e2e_ontology_proposal_unavailable') {
      test.skip(true, 'ontology proposal e2e helper requires data-e2e server');
    }
    throw err;
  }

  await page.goto(
    `/kbs/${kbId}/ontology-versions?ontologyTab=versions&ontologyProposal=${encodeURIComponent(proposalId)}`,
  );

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'ontology versions workspace requires explorer_runtime');
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
