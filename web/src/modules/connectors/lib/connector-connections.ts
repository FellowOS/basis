/** Shared helpers for workspace BOCP connection pickers and mapping routes. */

import { workspaceConnectorPanelPath } from '@/lib/nav-config.js';

export type StoredConnection = {
  workspace_id: string;
  service: string;
  connection_name: string;
  auth_type: string;
  connection_config: Record<string, unknown>;
  account_profile: Record<string, unknown>;
  revision: number;
  updated_at: string;
  has_credentials: boolean;
};

const CONNECTION_KEY_SEP = '\u001f';

export function workspaceConnectionOptionKey(
  conn: Pick<StoredConnection, 'service' | 'connection_name'>,
): string {
  return `${conn.service}${CONNECTION_KEY_SEP}${conn.connection_name}`;
}

export function parseWorkspaceConnectionOptionKey(key: string): {
  service: string;
  connection_name: string;
} {
  const sep = key.indexOf(CONNECTION_KEY_SEP);
  if (sep < 0) {
    return { service: key, connection_name: 'default' };
  }
  return {
    service: key.slice(0, sep),
    connection_name: key.slice(sep + CONNECTION_KEY_SEP.length),
  };
}

export function defaultConnectorStreamName(service: string): string {
  if (service === 'postgres' || service === 'mysql') {
    return 'table_records';
  }
  return 'records';
}

export function workspaceConnectorMappingEditPath(workspaceId: string, mappingId: string): string {
  return `/workspaces/${workspaceId}/connectors/mappings/${mappingId}/edit`;
}

export function workspaceConnectorMappingNewPath(
  workspaceId: string,
  opts?: { service?: string; connectionName?: string },
): string {
  const base = `/workspaces/${workspaceId}/connectors/mappings/new`;
  if (!opts?.service) {
    return base;
  }
  const params = new URLSearchParams({ service: opts.service });
  if (opts.connectionName) {
    params.set('connection', opts.connectionName);
  }
  return `${base}?${params.toString()}`;
}

export function workspaceConnectorsMappingsTabPath(workspaceId: string): string {
  return workspaceConnectorPanelPath(workspaceId, 'mappings');
}
