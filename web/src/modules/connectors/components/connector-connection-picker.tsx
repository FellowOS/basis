import { Link } from 'react-router-dom';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { workspaceConnectorPanelPath } from '@/lib/nav/nav-config.js';
import type { StoredConnection } from '@/modules/connectors/lib/connector-connections.js';
import { workspaceConnectionOptionKey } from '@/modules/connectors/lib/connector-connections.js';

type Copy = {
  connection_label: string;
  connection_placeholder: string;
  loading_connections: string;
  no_connections_hint: string;
  open_catalog_button: string;
};

type Props = {
  workspaceId: string;
  connections: StoredConnection[];
  connectionsLoading?: boolean;
  connectionKey: string;
  onConnectionKeyChange: (key: string) => void;
  copy: Copy;
  selectTestId?: string;
  labelId?: string;
};

export function ConnectorConnectionPicker({
  workspaceId,
  connections,
  connectionsLoading = false,
  connectionKey,
  onConnectionKeyChange,
  copy,
  selectTestId = 'suggest-connection-select',
  labelId = 'connector-mapping-connection',
}: Props) {
  if (connectionsLoading) {
    return <p className="text-sm text-muted-foreground">{copy.loading_connections}</p>;
  }
  if (connections.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{copy.no_connections_hint}</p>
        <Button asChild variant="outline" size="sm">
          <Link to={workspaceConnectorPanelPath(workspaceId, 'catalog')}>
            <PublicIcon name="plug-01" size={14} className="mr-1" />
            {copy.open_catalog_button}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={labelId}>{copy.connection_label}</Label>
      <Select value={connectionKey} onValueChange={onConnectionKeyChange}>
        <SelectTrigger id={labelId} data-testid={selectTestId} className="w-full">
          <SelectValue placeholder={copy.connection_placeholder} />
        </SelectTrigger>
        <SelectContent>
          {connections.map((conn) => {
            const key = workspaceConnectionOptionKey(conn);
            return (
              <SelectItem key={key} value={key}>
                <span className="font-mono text-xs">
                  {conn.service}
                  <span className="text-muted-foreground"> · </span>
                  {conn.connection_name}
                  <span className="text-muted-foreground"> ({conn.auth_type})</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
