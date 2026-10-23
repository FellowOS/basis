import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Page } from '@playwright/test';

import { e2eWorkspaceApiPath } from './api-v1-path.js';
import { bearerToken } from './helpers.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** SQLite file under `data/e2e/fixtures` with a `customers` table (API process can read it). */
export function seedE2eSqliteCustomersDb(): string {
  const dir = path.join(repoRoot, 'data', 'e2e', 'fixtures');
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, `customers-${Date.now()}.db`);
  const escaped = dbPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  execSync(
    `uv run python -c "import sqlite3; p='${escaped}'; c=sqlite3.connect(p); c.execute('CREATE TABLE customers (customer_id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, updated_at TEXT NOT NULL)'); c.execute(\\\"INSERT INTO customers VALUES ('c1', 'Acme', '2026-01-01')\\\"); c.commit(); c.close()"`,
    { cwd: repoRoot, stdio: 'pipe' },
  );
  return dbPath;
}

/** Match pytest `f"sqlite:///{path}"` for absolute POSIX paths (four slashes after `sqlite:`). */
export function sqlalchemySqliteDsn(absoluteDbPath: string): string {
  const normalized = absoluteDbPath.replace(/\\/g, '/');
  return `sqlite:///${normalized}`;
}

export async function putE2ePostgresSqliteConnection(
  page: Page,
  workspaceId: string,
  dbPath: string,
): Promise<void> {
  const token = await bearerToken(page);
  const response = await page.request.put(
    e2eWorkspaceApiPath(workspaceId, 'connectors/connections/postgres'),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        auth_type: 'database_dsn',
        connection_config: { dsn: sqlalchemySqliteDsn(dbPath) },
        credentials: { username: 'e2e', password: 'e2e' },
      },
    },
  );
  expect(response.ok(), `connection put failed: ${response.status()} ${await response.text()}`).toBeTruthy();
}

export type SuggestApiGroup = {
  drafts: Array<{
    draft: {
      external_table: string;
      target_class_uri: string;
      primary_key_column: string;
    };
  }>;
};

export async function suggestAutoTableMappings(
  page: Page,
  workspaceId: string,
): Promise<{ groups: SuggestApiGroup[]; skipped: Array<{ reason?: string }> }> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eWorkspaceApiPath(workspaceId, 'connectors/table-mappings/suggest'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {},
  });
  const text = await response.text();
  expect(response.ok(), `suggest failed: ${response.status()} ${text}`).toBeTruthy();
  const body = JSON.parse(text) as { groups?: SuggestApiGroup[]; skipped?: Array<{ reason?: string }> };
  return { groups: body.groups ?? [], skipped: body.skipped ?? [] };
}

export const PLAYWRIGHT_E2E_OAUTH_CODE = 'e2e_playwright_oauth_stub';

export async function putE2eGithubOAuthConfig(
  page: Page,
  workspaceId: string,
  redirectUri: string,
): Promise<void> {
  const token = await bearerToken(page);
  const response = await page.request.put(
    e2eWorkspaceApiPath(workspaceId, 'connectors/oauth-configs/github'),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        client_id: 'e2e_github_oauth_client',
        client_secret: 'e2e_github_oauth_secret',
        redirect_uri: redirectUri,
      },
    },
  );
  expect(response.ok(), `oauth-config put failed: ${response.status()} ${await response.text()}`).toBeTruthy();
}

export async function putE2eGithubApiKeyConnection(
  page: Page,
  workspaceId: string,
  personalAccessToken: string,
): Promise<void> {
  const token = await bearerToken(page);
  const response = await page.request.put(
    e2eWorkspaceApiPath(workspaceId, 'connectors/connections/github'),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        auth_type: 'api_key',
        connection_config: {},
        credentials: { personal_access_token: personalAccessToken },
      },
    },
  );
  expect(response.ok(), `github connection put failed: ${response.status()} ${await response.text()}`).toBeTruthy();
}

export type ConnectorMappingDraftPayload = SuggestApiGroup['drafts'][number]['draft'] &
  Record<string, unknown>;

export type BatchCreateSyncResult = {
  mapping_id?: string;
  fetched_rows?: number;
  added?: number;
  updated?: number;
  error?: string;
};

export async function batchCreateTableMappings(
  page: Page,
  workspaceId: string,
  mappings: ConnectorMappingDraftPayload[],
  opts?: { runSync?: boolean },
): Promise<{ mappings: Array<{ id: string }>; syncResults: BatchCreateSyncResult[] }> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eWorkspaceApiPath(workspaceId, 'connectors/table-mappings/batch-create'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { mappings, run_sync: opts?.runSync ?? false },
  });
  const text = await response.text();
  expect(response.ok(), `batch-create failed: ${response.status()} ${text}`).toBeTruthy();
  const body = JSON.parse(text) as {
    mappings?: Array<{ id: string }>;
    sync_results?: BatchCreateSyncResult[];
  };
  return { mappings: body.mappings ?? [], syncResults: body.sync_results ?? [] };
}

export async function suggestSqlTableMappings(
  page: Page,
  workspaceId: string,
  sqlTables: Array<{ provider: string; external_table: string }>,
): Promise<{ groups: SuggestApiGroup[] }> {
  const token = await bearerToken(page);
  const response = await page.request.post(e2eWorkspaceApiPath(workspaceId, 'connectors/table-mappings/suggest'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { sql_tables: sqlTables },
  });
  const text = await response.text();
  expect(response.ok(), `suggest failed: ${response.status()} ${text}`).toBeTruthy();
  const body = JSON.parse(text) as { groups: SuggestApiGroup[]; skipped?: Array<{ reason: string }> };
  if ((body.groups?.length ?? 0) === 0 && body.skipped?.length) {
    throw new Error(`suggest returned no groups; skipped: ${JSON.stringify(body.skipped)}`);
  }
  return body;
}

export async function postE2eConnectionCheck(
  page: Page,
  workspaceId: string,
  service: string,
): Promise<void> {
  const token = await bearerToken(page);
  const response = await page.request.post(
    e2eWorkspaceApiPath(workspaceId, `connectors/connections/${service}/check`),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.ok(), `check failed: ${response.status()} ${await response.text()}`).toBeTruthy();
}

export async function createCustomersTableMappingViaApi(
  page: Page,
  workspaceId: string,
): Promise<string> {
  const suggested = await suggestSqlTableMappings(page, workspaceId, [
    { provider: 'postgres', external_table: 'customers' },
  ]);
  const draft = suggested.groups[0]?.drafts[0]?.draft;
  if (!draft) {
    throw new Error('no mapping draft from suggest');
  }
  const token = await bearerToken(page);
  const response = await page.request.post(e2eWorkspaceApiPath(workspaceId, 'connectors/table-mappings/batch-create'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { mappings: [draft], run_sync: false },
  });
  const text = await response.text();
  expect(response.ok(), `batch-create failed: ${response.status()} ${text}`).toBeTruthy();
  const body = JSON.parse(text) as { mappings: Array<{ id: string }> };
  const mappingId = body.mappings[0]?.id;
  if (!mappingId) {
    throw new Error('batch-create returned no mapping id');
  }
  return mappingId;
}
