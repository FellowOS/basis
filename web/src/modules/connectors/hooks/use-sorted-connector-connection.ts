import { useEffect, useMemo, useState } from 'react';
import type { StoredConnection } from '@/modules/connectors/lib/connector-connections.js';
import {
  parseWorkspaceConnectionOptionKey,
  workspaceConnectionOptionKey,
} from '@/modules/connectors/lib/connector-connections.js';

export function useSortedConnectorConnections(connections: StoredConnection[]) {
  return useMemo(
    () =>
      [...connections].sort((a, b) =>
        `${a.service}:${a.connection_name}`.localeCompare(`${b.service}:${b.connection_name}`),
      ),
    [connections],
  );
}

export function useConnectorConnectionKey(
  sortedConnections: StoredConnection[],
  resetToken?: unknown,
) {
  const [connectionKey, setConnectionKey] = useState('');

  useEffect(() => {
    if (sortedConnections.length === 0) {
      setConnectionKey('');
      return;
    }
    const keys = sortedConnections.map((c) => workspaceConnectionOptionKey(c));
    if (!connectionKey || !keys.includes(connectionKey)) {
      setConnectionKey(keys[0]);
    }
  }, [sortedConnections, connectionKey, resetToken]);

  const selectedConnection = useMemo(() => {
    if (!connectionKey) {
      return null;
    }
    const { service, connection_name } = parseWorkspaceConnectionOptionKey(connectionKey);
    return (
      sortedConnections.find(
        (c) => c.service === service && c.connection_name === connection_name,
      ) ?? null
    );
  }, [connectionKey, sortedConnections]);

  return { connectionKey, setConnectionKey, selectedConnection };
}
