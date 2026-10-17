import { expect, type Page } from '@playwright/test';

import { E2E_KBS_COLLECTION, e2eKbPath } from './api-v1-path.js';

export async function bearerToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('basis_token'));
  if (!token) {
    throw new Error('Missing basis_token after login');
  }
  return token;
}

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

function isEditableRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'owner' || role === 'editor';
}

export async function defaultKbId(page: Page): Promise<string> {
  const token = await bearerToken(page);
  const response = await page.request.get(E2E_KBS_COLLECTION, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    kbs?: Array<{ id: string; my_role?: string }>;
  };
  const kbs = body.kbs ?? [];
  const editable = kbs.find((kb) => isEditableRole(kb.my_role));
  if (editable?.id) {
    return editable.id;
  }

  const stamp = Date.now();
  const created = await page.request.post(E2E_KBS_COLLECTION, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: `E2E KB ${stamp}`,
      description: 'Playwright isolation',
      visibility: 'restricted',
    },
  });
  expect(created.ok()).toBeTruthy();
  const kb = (await created.json()) as { id: string };
  if (!kb.id) {
    throw new Error('POST /api/v1/kbs did not return id');
  }
  return kb.id;
}

export async function fetchGraphStats(
  page: Page,
  kbId: string,
): Promise<{ node_count: number; edge_count: number }> {
  const token = await bearerToken(page);
  const response = await page.request.get(e2eKbPath(kbId, 'graph/stats'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { node_count: number; edge_count: number };
}

export async function searchGraphNodes(
  page: Page,
  kbId: string,
  query: string,
): Promise<Array<{ node: { id: string; content?: string; label?: string } }>> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eKbPath(kbId, 'graph/search'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { query, limit: 20 },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    results?: Array<{ node: { id: string; content?: string; label?: string } }>;
  };
  return body.results ?? [];
}

export async function fetchFirstGraphNodeId(page: Page, kbId: string): Promise<string> {
  const token = await bearerToken(page);
  const response = await page.request.get(`${e2eKbPath(kbId, 'graph/nodes')}?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { nodes?: Array<{ id: string }> };
  const id = body.nodes?.[0]?.id;
  if (!id) {
    throw new Error('No graph nodes available for lineage e2e');
  }
  return id;
}

export async function fetchProvenanceLineage(
  page: Page,
  kbId: string,
  nodeId: string,
): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  const token = await bearerToken(page);
  const response = await page.request.get(
    `${e2eKbPath(kbId, 'provenance')}?node_id=${encodeURIComponent(nodeId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { nodes: unknown[]; edges: unknown[] };
}

/** Ingest via API (wait + extract) — reliable for graph/provenance e2e. */
export async function ingestDocumentViaApi(
  page: Page,
  kbId: string,
  text: string,
): Promise<void> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eKbPath(kbId, 'documents'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      doc_id: `e2e-${Date.now()}`,
      text,
      wait: true,
      extract: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  const stats = await fetchGraphStats(page, kbId);
  expect(stats.node_count).toBeGreaterThan(0);
}

/** Minimal document ingest (pattern extract) for graph projection smoke. */
export async function fetchLatestIngestJobId(page: Page, kbId: string): Promise<string> {
  const token = await bearerToken(page);
  const response = await page.request.get(`${e2eKbPath(kbId, 'ingest/jobs')}?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { jobs?: Array<{ id: string }> };
  const id = body.jobs?.[0]?.id;
  if (!id) {
    throw new Error('No ingest jobs returned from GET .../ingest/jobs');
  }
  return id;
}

export async function fetchTemporalBounds(
  page: Page,
  kbId: string,
): Promise<{ min?: string; max?: string }> {
  const token = await bearerToken(page);
  const response = await page.request.get(e2eKbPath(kbId, 'temporal/bounds'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { min?: string; max?: string };
}

export async function runReasoningApplyViaApi(
  page: Page,
  kbId: string,
  facts: string[],
  rules: string[],
): Promise<{ derived_facts_persisted?: { created?: number } }> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eKbPath(kbId, 'reasoning/run'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      facts,
      rules,
      mode: 'forward',
      apply_to_graph: true,
    },
  });
  if (response.status() === 503) {
    throw new Error('explorer_unavailable');
  }
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { derived_facts_persisted?: { created?: number } };
}

/** Seed governance.tripped + graph decision (Playwright data-e2e API only). */
export async function seedGovernanceTrippedViaApi(
  page: Page,
  kbId: string,
): Promise<{ decisionId: string | null }> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eKbPath(kbId, '_e2e/governance-trip'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status() === 404) {
    throw new Error('e2e_governance_trip_unavailable');
  }
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { decision_id?: string | null };
  return { decisionId: body.decision_id ?? null };
}

/** Seed statement_conflict review item + alert (Playwright data-e2e API only). */
export async function seedStatementConflictViaApi(
  page: Page,
  kbId: string,
): Promise<{ reviewItemId: string; surfacePhrase: string }> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eKbPath(kbId, '_e2e/statement-conflict'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status() === 404) {
    throw new Error('e2e_statement_conflict_unavailable');
  }
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    review_item_id?: string | null;
    surface_phrase?: string;
  };
  if (!body.review_item_id) {
    throw new Error('e2e statement-conflict did not create review_item_id');
  }
  return {
    reviewItemId: body.review_item_id,
    surfacePhrase: body.surface_phrase ?? '',
  };
}

export async function proposeRememberViaApi(
  page: Page,
  kbId: string,
  content: string,
): Promise<{ reviewItemId: string }> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eKbPath(kbId, 'chat/remember'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { content },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { review_item_id?: string };
  if (!body.review_item_id) {
    throw new Error('POST /chat/remember did not return review_item_id');
  }
  return { reviewItemId: body.review_item_id };
}

export async function ingestPasteText(page: Page, kbId: string, text: string): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/capabilities') &&
        response.request().method() === 'GET' &&
        response.ok(),
    ),
    page.goto(`/kbs/${kbId}/sources`),
  ]);
  await expect(page.locator('.kb-library-workspace')).toBeVisible({ timeout: 60_000 });
  const addDoc = page.getByRole('button', { name: /添加文档|Add document/i }).first();
  await expect(addDoc).toBeVisible({ timeout: 60_000 });
  await addDoc.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: /粘贴文本|Paste text/i }).click();
  await dialog.locator('#add-text').fill(text);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /^保存$|^Save$/i }).click();
  await expect(page.getByText(text, { exact: false })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/就绪|Ready/i).first()).toBeVisible({ timeout: 90_000 });
  const stats = await fetchGraphStats(page, kbId);
  expect(stats.node_count).toBeGreaterThan(0);
}
