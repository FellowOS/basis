import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  fetchLatestIngestJobId,
  ingestDocumentViaApi,
  registerFreshUser,
} from './helpers';

test('sources job query opens processing history for job', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await ingestDocumentViaApi(page, kbId, 'Processing job deep link smoke.');
  const jobId = await fetchLatestIngestJobId(page, kbId);

  await page.goto(`/kbs/${kbId}/sources`);
  await expect(page.locator('.kb-library-workspace')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('sources-job-history')).toBeVisible();

  await page.goto(`/kbs/${kbId}/processing?job=${encodeURIComponent(jobId)}`);
  await expect(page.locator('.kb-processing-workspace')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(`processing-job-detail-${jobId}`)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId(`processing-job-copy-link-${jobId}`)).toBeVisible();
});
