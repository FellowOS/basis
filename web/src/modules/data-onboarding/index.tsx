import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConnectorMappingSuggestDialog } from '@/modules/connectors/components/connector-mapping-suggest-dialog.js';
import {
  ConsolePageLayout,
  DataPanel,
  DataPanelBody,
  DataPanelHeader,
} from '@/components/app/shared/console/index.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { fmt } from '@/i18n/format.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  workspaceConnectorsMappingsTabPath,
  type StoredConnection,
} from '@/lib/workspace/connector-connections.js';
import { workspaceConnectorPanelPath, workspacePath } from '@/lib/nav-config.js';
import { workspaceOpenApiGET } from '@/lib/openapi-client.js';

type WizardStep = 'connections' | 'suggest' | 'done';

export function DataOnboardingPage() {
  const { id: workspaceId } = useParams();
  const { t, locale } = useI18n();
  const w = t.data_onboarding.wizard;
  const [step, setStep] = useState<WizardStep>('connections');
  const [connections, setConnections] = useState<StoredConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [sqlTableInput, setSqlTableInput] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  const loadConnections = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingConnections(true);
    try {
      const res = await workspaceOpenApiGET<{ connections: StoredConnection[] }>(
        workspaceId,
        'connectors/connections',
      );
      setConnections(res.connections ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setLoadingConnections(false);
    }
  }, [workspaceId, locale]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const sqlTargets = useMemo(() => {
    if (!sqlTableInput.trim()) return [];
    const lines = sqlTableInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const sqlConnections = connections.filter((c) =>
      ['postgres', 'mysql'].includes(c.service),
    );
    if (sqlConnections.length === 0) return [];
    const targets: Array<{
      provider: string;
      connection_name: string;
      external_table: string;
    }> = [];
    for (const line of lines) {
      const [maybeService, table] = line.includes(':')
        ? line.split(':', 2).map((x) => x.trim())
        : [null, line];
      const conn =
        (maybeService
          ? sqlConnections.find((c) => c.service === maybeService)
          : sqlConnections[0]) ?? sqlConnections[0];
      if (table) {
        targets.push({
          provider: conn.service,
          connection_name: conn.connection_name,
          external_table: table,
        });
      }
    }
    return targets;
  }, [connections, sqlTableInput]);

  if (!workspaceId) return null;

  const crumbs = [
    {
      label: t.core.workspace_nav.workspace_zones.connectors,
      to: workspaceConnectorPanelPath(workspaceId, 'catalog'),
    },
    { label: w.title },
  ];

  return (
    <ConsolePageLayout crumbs={crumbs} subtitle={w.subtitle}>
      <div className="mb-6 flex flex-wrap gap-2">
        {(['connections', 'suggest', 'done'] as WizardStep[]).map((s, idx) => (
          <Badge
            key={s}
            variant={step === s ? 'default' : 'outline'}
            className="text-xs"
          >
            {idx + 1}. {w.steps[s]}
          </Badge>
        ))}
      </div>

      {step === 'connections' ? (
        <DataPanel>
          <DataPanelHeader title={w.connections_title} subtitle={w.connections_subtitle} />
          <DataPanelBody className="space-y-4">
            {loadingConnections ? (
              <p className="text-sm text-muted-foreground">{w.loading_connections}</p>
            ) : connections.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{w.no_connections}</p>
                <Button asChild variant="outline" size="sm">
                  <Link to={workspaceConnectorPanelPath(workspaceId, 'catalog')}>
                    <PublicIcon name="plug-01" size={14} className="mr-1" />
                    {w.open_catalog}
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {connections.map((c) => (
                  <li key={`${c.service}:${c.connection_name}`} className="px-3 py-2">
                    <span className="font-medium">{c.service}</span>
                    <span className="text-muted-foreground"> · {c.connection_name}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <Label htmlFor="sql-tables">{w.sql_tables_label}</Label>
              <Input
                id="sql-tables"
                value={sqlTableInput}
                onChange={(e) => setSqlTableInput(e.target.value)}
                placeholder={w.sql_tables_placeholder}
              />
              <p className="text-xs text-muted-foreground">{w.sql_tables_hint}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                disabled={connections.length === 0}
                onClick={() => {
                  setStep('suggest');
                  setSuggestOpen(true);
                }}
              >
                {w.continue_to_suggest}
              </Button>
            </div>
          </DataPanelBody>
        </DataPanel>
      ) : null}

      {step === 'suggest' ? (
        <DataPanel>
          <DataPanelHeader title={w.suggest_title} subtitle={w.suggest_subtitle} />
          <DataPanelBody className="space-y-3">
            <p className="text-sm text-muted-foreground">{w.suggest_hint}</p>
            <Button variant="outline" size="sm" onClick={() => setSuggestOpen(true)}>
              {w.reopen_suggest}
            </Button>
          </DataPanelBody>
        </DataPanel>
      ) : null}

      {step === 'done' ? (
        <DataPanel>
          <DataPanelHeader title={w.done_title} subtitle={fmt(w.done_subtitle, { count: appliedCount })} />
          <DataPanelBody className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={workspaceConnectorsMappingsTabPath(workspaceId)}>{w.view_mappings}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={workspacePath(workspaceId, 'entities')}>{w.view_entities}</Link>
            </Button>
          </DataPanelBody>
        </DataPanel>
      ) : null}

      <ConnectorMappingSuggestDialog
        workspaceId={workspaceId}
        open={suggestOpen}
        onOpenChange={(open) => {
          setSuggestOpen(open);
          if (!open && step === 'suggest' && appliedCount === 0) {
            setStep('connections');
          }
        }}
        sqlTables={sqlTargets}
        onApplied={(count) => {
          setAppliedCount(count);
          setStep('done');
          setSuggestOpen(false);
        }}
      />
    </ConsolePageLayout>
  );
}
