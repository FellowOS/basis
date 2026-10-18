import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  proposeRememberViaApi,
  registerFreshUser,
  seedGovernanceTrippedViaApi,
  seedStatementConflictViaApi,
} from './helpers';

test('review queue surfaces link to ontology versions tab', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await page.goto(`/kbs/${kbId}/review`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  const ontologyLink = page.getByRole('link', {
    name: /Ontology → Versions|本体 → 版本/i,
  });
  await expect(ontologyLink.first()).toBeVisible({ timeout: 60_000 });
  await ontologyLink.first().click();
  await expect(page).toHaveURL(/ontology-versions/);
});

test('sources query opens ingest connectors dialog', async ({ page }) => {
  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await page.goto(`/kbs/${kbId}/sources?connectors=1`);
  await expect(page.locator('.kb-library-workspace')).toBeVisible({ timeout: 60_000 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText(/Ingest sources|摄入来源/i)).toBeVisible();
});

test('review queue deep link highlights remembered fact item', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const fact = `E2E remembered fact ${Date.now()}`;
  const { reviewItemId } = await proposeRememberViaApi(page, kbId, fact);

  await page.goto(
    `/kbs/${kbId}/review?reviewItem=${encodeURIComponent(reviewItemId)}`,
  );

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  const card = page.locator(`#review-item-${reviewItemId}`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toHaveClass(/ring-primary/);
  await expect(card.getByText(fact)).toBeVisible();
});

test('statement conflict alert links to review queue item', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  let reviewItemId: string;
  let surfacePhrase: string;
  try {
    ({ reviewItemId, surfacePhrase } = await seedStatementConflictViaApi(page, kbId));
  } catch (err) {
    if (String(err).includes('e2e_statement_conflict_unavailable')) {
      test.skip(true, 'statement conflict e2e helper only on data-e2e API');
    }
    throw err;
  }

  await page.goto(`/kbs/${kbId}/alerts`);
  const alertRow = page.locator('li').filter({ hasText: surfacePhrase });
  await expect(alertRow).toBeVisible({ timeout: 30_000 });
  await alertRow.getByRole('link', { name: /Open review queue|打开审核队列/i }).click();
  await expect(page).toHaveURL(new RegExp(`reviewItem=${encodeURIComponent(reviewItemId)}`));

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  const card = page.locator(`#review-item-${reviewItemId}`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toHaveClass(/ring-primary/);
  await expect(card.getByText(surfacePhrase)).toBeVisible();
});

test('governance tripped alert links to decisions tab', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  let decisionId: string | null;
  try {
    ({ decisionId } = await seedGovernanceTrippedViaApi(page, kbId));
  } catch (err) {
    if (String(err).includes('e2e_governance_trip_unavailable')) {
      test.skip(true, 'governance e2e helper only on data-e2e API');
    }
    throw err;
  }
  if (!decisionId) {
    test.skip(true, 'governance trip did not record explorer decision_id');
  }

  await page.goto(`/kbs/${kbId}/alerts`);
  await page.getByRole('link', { name: /Open decisions|打开决策记录/i }).click();
  await expect(page).toHaveURL(/\/decisions/);
  await expect(page).toHaveURL(new RegExp(`decision=${encodeURIComponent(decisionId!)}`));
});

test('approve remember records governance decision deep link', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const fact = `E2E approve decision ${Date.now()}`;
  const { reviewItemId } = await proposeRememberViaApi(page, kbId, fact);

  await page.goto(`/kbs/${kbId}/review?reviewItem=${encodeURIComponent(reviewItemId)}`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  const card = page.locator(`#review-item-${reviewItemId}`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByRole('button', { name: /Approve fact|批准记入/i }).click();

  const decisionLink = page.getByTestId('review-approve-decision-link');
  await expect(decisionLink).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('review-decision-narrative')).toBeVisible({ timeout: 30_000 });
  await decisionLink.click();
  await expect(page).toHaveURL(/\/decisions/);
  await expect(page).toHaveURL(/decision=/);
});

test('resolved review deep link shows banner and decision links', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const fact = `E2E resolved deep link ${Date.now()}`;
  const { reviewItemId } = await proposeRememberViaApi(page, kbId, fact);

  await page.goto(`/kbs/${kbId}/review?reviewItem=${encodeURIComponent(reviewItemId)}`);

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  const card = page.locator(`#review-item-${reviewItemId}`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByRole('button', { name: /Approve fact|批准记入/i }).click();
  await expect(page.getByTestId('review-approve-decision-link')).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByTestId('review-resolved-item-banner')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(/^review-resolved-decision-/).first()).toBeVisible();
});

test('search graph tab shows temporal hint and link to graph workspace', async ({ page }) => {
  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await page.goto(`/kbs/${kbId}/search`);
  await page.getByRole('button', { name: /^Graph$|^图谱节点$/ }).click();

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'graph search requires explorer_runtime');
  }

  await expect(
    page.getByText(/as_of|截至时刻|active at that instant|该时点仍活跃/i),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: /Open in graph|在图谱中打开/i }).click();
  await expect(page).toHaveURL(new RegExp(`/kbs/${kbId}/graph`));
});
