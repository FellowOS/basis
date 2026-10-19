import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ConsolePageLayout,
  DataPanel,
  DataPanelBody,
  DataPanelHeader,
} from '@/components/app/shared/console/index.js';
import { JsonEditor } from '@/components/app/shared/primitives/json-editor.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Badge } from '@/components/ui/badge.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Switch } from '@/components/ui/switch.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleDateTime } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import {
  kbConnectorMappingEditPath,
  kbConnectorMappingNewPath,
  type KbStoredConnection,
} from '@/lib/kb-connector-connections.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import {
  type ConnectorPanel,
  kbConnectorPanelPath,
  kbPath,
} from '@/lib/nav-config.js';
import {
  kbOpenApiDELETE,
  kbOpenApiGET,
  kbOpenApiPOST,
  kbOpenApiPUT,
} from '@/lib/openapi-client.js';
import { resourceCardSurfaceClass } from '@/lib/ui-classes/card-surface.js';
import {
  connectorAuthNeedsPkce,
  generateOAuthState,
  generatePkcePair,
  kbConnectorOAuthRedirectUri,
  savePendingConnectorOAuth,
} from '@/lib/kb-connector-oauth.js';
import { cn } from '@/lib/utils.js';

type CatalogConnector = {
  service: string;
  display_name: string;
  description?: string;
  categories?: string[];
  auth?: Array<{ auth_mode: string; oauth2?: { pkce_s256?: boolean } }>;
  streams?: Array<{ name: string; display_name: string }>;
  tools?: Array<{ id: string; name: string }>;
};

type TableMappingDto = {
  id: string;
  source_id: string;
  provider?: string;
  connection_name?: string;
  stream_name: string;
  external_table: string;
  primary_key_column: string;
  cursor_column?: string | null;
  label_column: string;
  target_class_uri: string;
  sync_direction: string;
  writeback_mode: string;
  updated_at: string;
};

type OutboxItemDto = {
  id: string;
  entity_id: string;
  status: string;
  created_at: string;
  patch: {
    provider?: string;
    external_table?: string;
    external_pk?: string;
    changes?: Record<string, { old?: unknown; new?: unknown }>;
  };
};

type ConnectorRunDto = {
  id: string;
  service: string;
  operation_kind: string;
  target_id: string;
  connection_name: string;
  started_at: string;
  ok: boolean;
};

const CONNECTOR_PANELS: ConnectorPanel[] = ['catalog', 'mappings', 'policy', 'runs'];

function parseConnectorPanel(raw: string | undefined): ConnectorPanel | null {
  if (raw && (CONNECTOR_PANELS as readonly string[]).includes(raw)) {
    return raw as ConnectorPanel;
  }
  return null;
}

/** Legacy `/connectors` and `?tab=` → panel routes. */
export function KbConnectorsRedirect() {
  const { id: kbId } = useParams();
  const [searchParams] = useSearchParams();
  const panel = parseConnectorPanel(searchParams.get('tab') ?? undefined);
  if (!kbId) return null;
  return <Navigate to={kbConnectorPanelPath(kbId, panel ?? 'catalog')} replace />;
}

export function KbConnectorsPage() {
  const { id: kbId, panel: panelParam } = useParams<{ id: string; panel: string }>();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const c = t.kbConnectors;
  const { getKb } = useKbCatalog();

  const panel = parseConnectorPanel(panelParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [streamsOnly, setStreamsOnly] = useState(true);

  const [catalogStats, setCatalogStats] = useState({ providers: 0, providers_with_streams: 0 });
  const [connectors, setConnectors] = useState<CatalogConnector[]>([]);
  const [connections, setConnections] = useState<KbStoredConnection[]>([]);
  const [mappings, setMappings] = useState<TableMappingDto[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItemDto[]>([]);
  const [runs, setRuns] = useState<ConnectorRunDto[]>([]);

  const [allowedProvidersInput, setAllowedProvidersInput] = useState('*');
  const [platformAllowedDisplay, setPlatformAllowedDisplay] = useState('*');
  const [effectiveAllowedDisplay, setEffectiveAllowedDisplay] = useState('*');
  const [actionPolicyInput, setActionPolicyInput] = useState('{}');

  function formatAllowlistDisplay(value: string[] | string | undefined): string {
    if (!value || value === '*') return '*';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  // Connect dialog state
  const [selectedConnector, setSelectedConnector] = useState<CatalogConnector | null>(null);
  const [connName, setConnName] = useState('default');
  const [connAuthMode, setConnAuthMode] = useState('database_dsn');
  const [connConfigJson, setConnConfigJson] = useState(
    '{\n  "host": "localhost",\n  "port": 5432,\n  "database": "erp"\n}',
  );
  const [connCredsJson, setConnCredsJson] = useState(
    '{\n  "username": "postgres",\n  "password": ""\n}',
  );
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthAuthorizeUrl, setOauthAuthorizeUrl] = useState<string | null>(null);
  const [savingConn, setSavingConn] = useState(false);
  const [checkingKey, setCheckingKey] = useState<string | null>(null);

  // Tool runner state
  const [toolService, setToolService] = useState('github');
  const [toolId, setToolId] = useState('list_repositories');
  const [toolArgsJson, setToolArgsJson] = useState('{\n  "per_page": 10\n}');
  const [runningTool, setRunningTool] = useState(false);
  const [toolResultJson, setToolResultJson] = useState<string | null>(null);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleteMappingId, setDeleteMappingId] = useState<string | null>(null);
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null);

  const loadCatalogAndConnections = useCallback(async () => {
    if (!kbId) return;
    try {
      const [catRes, connRes] = await Promise.all([
        kbOpenApiGET<{
          stats: { providers: number; providers_with_streams: number };
          connectors: CatalogConnector[];
        }>(kbId, 'connectors/catalog', {
          params: {
            query: {
              has_streams_only: streamsOnly,
              query: searchQuery.trim() || undefined,
              limit: 60,
            },
          },
        }),
        kbOpenApiGET<{ connections: KbStoredConnection[] }>(kbId, 'connectors/connections'),
      ]);
      setCatalogStats(catRes.stats);
      setConnectors(catRes.connectors ?? []);
      setConnections(connRes.connections ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }, [kbId, streamsOnly, searchQuery, locale]);

  const loadMappings = useCallback(async () => {
    if (!kbId) return;
    try {
      const res = await kbOpenApiGET<{ mappings: TableMappingDto[] }>(
        kbId,
        'connectors/table-mappings',
      );
      setMappings(res.mappings ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }, [kbId, locale]);

  const loadPolicyAndOutbox = useCallback(async () => {
    if (!kbId) return;
    try {
      const [polRes, outRes] = await Promise.all([
        kbOpenApiGET<{
          platform_allowed_providers: string[] | string;
          allowed_providers: string[] | string;
          effective_allowed_providers: string[] | string;
          action_policy: Record<string, unknown>;
        }>(kbId, 'connectors/policy'),
        kbOpenApiGET<{ items: OutboxItemDto[] }>(kbId, 'connectors/outbox'),
      ]);
      const ap = polRes.allowed_providers;
      setAllowedProvidersInput(formatAllowlistDisplay(ap));
      setPlatformAllowedDisplay(formatAllowlistDisplay(polRes.platform_allowed_providers));
      setEffectiveAllowedDisplay(formatAllowlistDisplay(polRes.effective_allowed_providers));
      setActionPolicyInput(JSON.stringify(polRes.action_policy ?? {}, null, 2));
      setOutboxItems(outRes.items ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }, [kbId, locale]);

  const loadRuns = useCallback(async () => {
    if (!kbId) return;
    try {
      const res = await kbOpenApiGET<{ runs: ConnectorRunDto[] }>(kbId, 'connectors/runs');
      setRuns(res.runs ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }, [kbId, locale]);

  useEffect(() => {
    void loadCatalogAndConnections();
  }, [loadCatalogAndConnections]);

  useEffect(() => {
    if (panel === 'mappings') void loadMappings();
    if (panel === 'policy') void loadPolicyAndOutbox();
    if (panel === 'runs') void loadRuns();
  }, [panel, loadMappings, loadPolicyAndOutbox, loadRuns]);

  function goToNewMapping(prefill?: KbStoredConnection) {
    if (!kbId) return;
    navigate(
      kbConnectorMappingNewPath(kbId, {
        service: prefill?.service,
        connectionName: prefill?.connection_name,
      }),
    );
  }

  if (!kbId) return null;

  async function handleSaveConnection() {
    if (!kbId || !selectedConnector) return;
    setSavingConn(true);
    try {
      const cfg = JSON.parse(connConfigJson || '{}') as Record<string, unknown>;
      const creds = JSON.parse(connCredsJson || '{}') as Record<string, unknown>;
      await kbOpenApiPUT(
        kbId,
        `connectors/connections/${selectedConnector.service}/${connName.trim() || 'default'}`,
        {
          body: {
            auth_type: connAuthMode,
            connection_config: cfg,
            credentials: creds,
          },
        },
      );
      setSelectedConnector(null);
      await loadCatalogAndConnections();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setSavingConn(false);
    }
  }

  async function handleCheckConnection(service: string, name: string) {
    if (!kbId) return;
    const key = `${service}:${name}`;
    setCheckingKey(key);
    try {
      await kbOpenApiPOST(kbId, `connectors/connections/${service}/${name}/check`);
      toast.success(c.catalog.checkSuccess);
      await loadCatalogAndConnections();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setCheckingKey(null);
    }
  }

  async function handleDeleteConnection(service: string, name: string) {
    if (!kbId) return;
    try {
      await kbOpenApiDELETE(kbId, `connectors/connections/${service}/${name}`);
      await loadCatalogAndConnections();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }

  async function handleDeleteMapping(mappingId: string) {
    if (!kbId) return;
    setDeletingMappingId(mappingId);
    try {
      await kbOpenApiDELETE(kbId, `connectors/table-mappings/${mappingId}`);
      toast.success(c.mappings.deletedToast);
      setDeleteMappingId(null);
      await loadMappings();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setDeletingMappingId(null);
    }
  }

  async function handleSyncMapping(mappingId: string) {
    if (!kbId) return;
    setSyncingId(mappingId);
    try {
      const stats = await kbOpenApiPOST<{
        fetched_rows: number;
        added: number;
        updated: number;
        unchanged: number;
        deleted: number;
      }>(kbId, `connectors/table-mappings/${mappingId}/sync`);
      toast.success(
        fmt(c.mappings.syncResultSummary, {
          fetched: stats.fetched_rows,
          added: stats.added,
          updated: stats.updated,
          unchanged: stats.unchanged,
          deleted: stats.deleted,
        }),
      );
      await loadMappings();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleSavePolicy() {
    if (!kbId) return;
    try {
      const trimmed = allowedProvidersInput.trim();
      const allowed =
        trimmed === '*' || !trimmed
          ? '*'
          : trimmed
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      const actionPolicy = JSON.parse(actionPolicyInput || '{}') as Record<string, unknown>;
      await kbOpenApiPUT(kbId, 'connectors/policy', {
        body: {
          allowed_providers: allowed,
          action_policy: actionPolicy,
        },
      });
      toast.success(c.policy.savedToast);
      await loadPolicyAndOutbox();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }

  async function handleBuildOAuthUrl() {
    if (!kbId || !selectedConnector) return;
    if (!oauthClientId.trim() || !oauthClientSecret.trim()) {
      toast.error(c.catalog.oauthClientRequired);
      return;
    }
    try {
      const redirectUri = kbConnectorOAuthRedirectUri(kbId);
      await kbOpenApiPUT(kbId, `connectors/oauth-configs/${selectedConnector.service}`, {
        body: {
          client_id: oauthClientId.trim(),
          client_secret: oauthClientSecret.trim(),
          redirect_uri: redirectUri,
        },
      });
      const cfg = JSON.parse(connConfigJson || '{}') as Record<string, unknown>;
      const needsPkce = connectorAuthNeedsPkce(selectedConnector.auth);
      const state = generateOAuthState();
      let codeVerifier: string | undefined;
      let codeChallenge: string | undefined;
      if (needsPkce) {
        const pkce = await generatePkcePair();
        codeVerifier = pkce.verifier;
        codeChallenge = pkce.challenge;
      }
      const res = await kbOpenApiPOST<{ authorize_url: string; state: string }>(
        kbId,
        `connectors/oauth/${selectedConnector.service}/authorize-url`,
        {
          body: {
            state,
            redirect_uri: redirectUri,
            connection_config: cfg,
            code_challenge: codeChallenge ?? null,
          },
        },
      );
      savePendingConnectorOAuth({
        kbId,
        service: selectedConnector.service,
        connectionName: connName.trim() || 'default',
        connectionConfig: cfg,
        state: res.state ?? state,
        redirectUri,
        codeVerifier,
      });
      setOauthAuthorizeUrl(res.authorize_url);
      toast.success(c.catalog.oauthUrlGenerated);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }

  async function handleRunTool() {
    if (!kbId) return;
    setRunningTool(true);
    try {
      const args = JSON.parse(toolArgsJson || '{}') as Record<string, unknown>;
      const res = await kbOpenApiPOST(kbId, 'connectors/tools/execute', {
        body: {
          service: toolService.trim(),
          tool_id: toolId.trim(),
          connection_name: 'default',
          arguments: args,
        },
      });
      setToolResultJson(JSON.stringify(res, null, 2));
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setRunningTool(false);
    }
  }

  if (!panel) {
    return kbId ? <Navigate to={kbConnectorPanelPath(kbId, 'catalog')} replace /> : null;
  }

  const panelCrumbLabel =
    panel === 'catalog'
      ? t.menu.kb.connectorCatalog
      : panel === 'mappings'
        ? t.menu.kb.connectorStreamMappings
        : panel === 'policy'
          ? t.menu.kb.connectorActionPolicy
          : t.menu.kb.connectorRunLogs;

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: getKb(kbId)?.name ?? kbId, to: kbPath(kbId!, 'graph') },
        { label: t.menu.kbZones.connectors, to: kbConnectorPanelPath(kbId!, 'catalog') },
        { label: panelCrumbLabel },
      ]}
      subtitle={t.pages.kbSubtitles.connectors}
    >
      {panel === 'catalog' ? (
        <div className="space-y-4" data-testid="connectors-panel-catalog">
          <DataPanel>
            <DataPanelHeader title={c.catalog.configuredTitle} />
            <DataPanelBody padded={false}>
              {connections.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {c.catalog.configuredEmpty}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {connections.map((conn) => {
                    const key = `${conn.service}:${conn.connection_name}`;
                    return (
                      <div
                        key={key}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                        data-testid={`configured-connection-${conn.service}-${conn.connection_name}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Badge variant="outline" className="font-mono text-xs">
                            {conn.service}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {conn.connection_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({conn.auth_type})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => goToNewMapping(conn)}
                            data-testid={`create-mapping-from-connection-${conn.service}-${conn.connection_name}`}
                          >
                            <PublicIcon name="plus-01" size={14} className="mr-1" />
                            {c.catalog.createMappingButton}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={checkingKey === key}
                            onClick={() => void handleCheckConnection(conn.service, conn.connection_name)}
                          >
                            {checkingKey === key ? c.catalog.checking : c.catalog.checkButton}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDeleteConnection(conn.service, conn.connection_name)}
                          >
                            {c.catalog.deleteButton}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DataPanelBody>
          </DataPanel>

          <DataPanel>
            <DataPanelHeader
              title={c.catalog.directoryTitle}
              subtitle={fmt(c.catalog.statsSummary, {
                providers: catalogStats.providers,
                withStreams: catalogStats.providers_with_streams,
              })}
            />
            <DataPanelBody padded={false}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={c.catalog.searchPlaceholder}
                  className="max-w-md"
                  data-testid="connectors-catalog-search"
                />
                <div className="flex items-center gap-2 text-xs">
                  <Switch
                    id="streams-only-switch"
                    checked={streamsOnly}
                    onCheckedChange={setStreamsOnly}
                  />
                  <Label htmlFor="streams-only-switch">{c.catalog.streamsOnlyFilter}</Label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
                {connectors.map((item) => {
                  const firstAuth = item.auth?.[0]?.auth_mode ?? 'custom';
                  return (
                    <div
                      key={item.service}
                      className={cn(resourceCardSurfaceClass, 'flex flex-col justify-between gap-3 p-3.5')}
                      data-testid={`catalog-connector-card-${item.service}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-foreground">
                            {item.display_name}
                          </span>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {firstAuth}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>
                            {fmt(c.catalog.streamsBadge, { count: item.streams?.length ?? 0 })}
                          </span>
                          <span>·</span>
                          <span>
                            {fmt(c.catalog.toolsBadge, { count: item.tools?.length ?? 0 })}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedConnector(item);
                            setConnAuthMode(firstAuth);
                            setOauthAuthorizeUrl(null);
                            if (firstAuth === 'database_dsn') {
                              setConnConfigJson(
                                JSON.stringify(
                                  {
                                    host: 'localhost',
                                    port: item.service === 'mysql' ? 3306 : 5432,
                                    database: 'erp',
                                  },
                                  null,
                                  2,
                                ),
                              );
                              setConnCredsJson(
                                JSON.stringify(
                                  { username: item.service, password: '' },
                                  null,
                                  2,
                                ),
                              );
                            } else if (firstAuth === 'api_key') {
                              setConnConfigJson('{\n}');
                              setConnCredsJson(
                                JSON.stringify({ api_key: '' }, null, 2),
                              );
                            } else if (firstAuth === 'oauth2') {
                              setConnConfigJson('{\n}');
                              setConnCredsJson(
                                JSON.stringify({ access_token: '' }, null, 2),
                              );
                            }
                          }}
                          data-testid={`connect-btn-${item.service}`}
                        >
                          <PublicIcon name="plug-01" size={14} className="mr-1" />
                          {c.catalog.connectButton}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataPanelBody>
          </DataPanel>
        </div>
      ) : null}

      {panel === 'mappings' ? (
        <div className="space-y-4" data-testid="connectors-panel-mappings">
          <DataPanel>
            <DataPanelHeader
              title={c.mappings.title}
              subtitle={c.mappings.subtitle}
              actions={
                <Button
                  size="sm"
                  onClick={() => goToNewMapping()}
                  data-testid="create-table-mapping-btn"
                >
                  <PublicIcon name="plus-01" size={14} className="mr-1" />
                  {c.mappings.createButton}
                </Button>
              }
            />
            <DataPanelBody padded={false}>
              {mappings.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">{c.mappings.emptyTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.mappings.emptyDescription}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {mappings.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                      data-testid={`table-mapping-row-${m.id}`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-foreground">
                            {m.external_table}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {m.target_class_uri}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.provider && m.connection_name
                            ? `${m.provider} · ${m.connection_name} · `
                            : ''}
                          {m.stream_name} · PK: {m.primary_key_column} · Label: {m.label_column} ·{' '}
                          {m.sync_direction === 'bidirectional'
                            ? fmt(c.mappings.directionBidirectional, { mode: m.writeback_mode })
                            : c.mappings.directionInbound}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            to={kbConnectorMappingEditPath(kbId, m.id)}
                            data-testid={`edit-mapping-btn-${m.id}`}
                          >
                            {c.mappings.editButton}
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteMappingId(m.id)}
                          data-testid={`delete-mapping-btn-${m.id}`}
                        >
                          {c.mappings.deleteButton}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={syncingId === m.id}
                          onClick={() => void handleSyncMapping(m.id)}
                          data-testid={`sync-mapping-btn-${m.id}`}
                        >
                          <PublicIcon name="sync" size={14} className="mr-1" />
                          {syncingId === m.id ? c.mappings.syncing : c.mappings.syncButton}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DataPanelBody>
          </DataPanel>
        </div>
      ) : null}

      {panel === 'policy' ? (
        <div className="space-y-4" data-testid="connectors-panel-policy">
          <DataPanel>
            <DataPanelHeader title={c.policy.title} subtitle={c.policy.subtitle} />
            <DataPanelBody>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{c.policy.platformAllowedLabel}</Label>
                  <Input
                    value={platformAllowedDisplay}
                    readOnly
                    className="bg-muted/40"
                    data-testid="policy-platform-allowed-providers"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{c.policy.allowedProvidersLabel}</Label>
                  <Input
                    value={allowedProvidersInput}
                    onChange={(e) => setAllowedProvidersInput(e.target.value)}
                    data-testid="policy-allowed-providers-input"
                  />
                  <p className="text-xs text-muted-foreground">{c.policy.allowedProvidersHint}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{c.policy.effectiveAllowedLabel}</Label>
                  <Input
                    value={effectiveAllowedDisplay}
                    readOnly
                    className="bg-muted/40 font-mono text-xs"
                    data-testid="policy-effective-allowed-providers"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{c.policy.actionPolicyLabel}</Label>
                  <JsonEditor
                    height={140}
                    value={actionPolicyInput}
                    onChange={setActionPolicyInput}
                  />
                </div>
                <Button size="sm" onClick={() => void handleSavePolicy()} data-testid="save-connector-policy-btn">
                  {c.policy.savePolicy}
                </Button>
              </div>
            </DataPanelBody>
          </DataPanel>

          <DataPanel>
            <DataPanelHeader title={c.policy.outboxTitle} />
            <DataPanelBody padded={false}>
              {outboxItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{c.policy.outboxEmpty}</p>
              ) : (
                <div className="divide-y divide-border">
                  {outboxItems.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="space-y-1">
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.patch.provider} · {item.patch.external_table} ({item.patch.external_pk})
                        </div>
                        <div className="flex flex-wrap gap-2 font-mono text-xs">
                          {Object.entries(item.patch.changes ?? {}).map(([col, chg]) => (
                            <span key={col}>
                              <strong>{col}:</strong> {String(chg.old ?? '—')} → {String(chg.new ?? '—')}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </DataPanelBody>
          </DataPanel>

          <DataPanel>
            <DataPanelHeader title={c.policy.toolRunnerTitle} />
            <DataPanelBody>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{c.policy.toolServiceLabel}</Label>
                  <Input
                    value={toolService}
                    onChange={(e) => setToolService(e.target.value)}
                    data-testid="tool-runner-service-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{c.policy.toolIdLabel}</Label>
                  <Input
                    value={toolId}
                    onChange={(e) => setToolId(e.target.value)}
                    data-testid="tool-runner-id-input"
                  />
                </div>
                <div className="col-span-full space-y-1">
                  <Label>{c.policy.toolArgsLabel}</Label>
                  <JsonEditor
                    height={110}
                    value={toolArgsJson}
                    onChange={setToolArgsJson}
                  />
                </div>
                <div className="col-span-full flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runningTool}
                    onClick={() => void handleRunTool()}
                    data-testid="run-connector-tool-btn"
                  >
                    {runningTool ? c.policy.runningTool : c.policy.runToolButton}
                  </Button>
                </div>
                {toolResultJson && (
                  <div className="col-span-full">
                    <JsonEditor
                      height={160}
                      readOnly
                      value={toolResultJson}
                    />
                  </div>
                )}
              </div>
            </DataPanelBody>
          </DataPanel>
        </div>
      ) : null}

      {panel === 'runs' ? (
        <div data-testid="connectors-panel-runs">
          <DataPanel>
            <DataPanelHeader title={c.runs.title} />
            <DataPanelBody padded={false}>
              {runs.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{c.runs.empty}</p>
              ) : (
                <div className="divide-y divide-border">
                  {runs.map((run) => (
                    <div key={run.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant={run.ok ? 'secondary' : 'destructive'}>
                          {run.ok ? c.runs.statusOk : c.runs.statusFailed}
                        </Badge>
                        <span className="font-mono text-xs font-medium">{run.service}</span>
                        <span className="text-xs text-muted-foreground">{run.operation_kind}</span>
                        <span className="font-mono text-xs text-muted-foreground">{run.target_id}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatLocaleDateTime(locale as Locale, run.started_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </DataPanelBody>
          </DataPanel>
        </div>
      ) : null}

      {/* Connect Dialog */}
      <Dialog open={Boolean(selectedConnector)} onOpenChange={(o) => !o && setSelectedConnector(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fmt(c.catalog.dialogTitle, { name: selectedConnector?.display_name ?? '' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{c.catalog.connectionNameLabel}</Label>
              <Input value={connName} onChange={(e) => setConnName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{c.catalog.authModeLabel}</Label>
              <Input value={connAuthMode} onChange={(e) => setConnAuthMode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{c.catalog.configJsonLabel}</Label>
              <JsonEditor
                height={120}
                value={connConfigJson}
                onChange={setConnConfigJson}
              />
            </div>
            <div className="space-y-1">
              <Label>{c.catalog.credentialsJsonLabel}</Label>
              <JsonEditor
                height={120}
                value={connCredsJson}
                onChange={setConnCredsJson}
              />
            </div>
            {connAuthMode === 'oauth2' && (
              <div className="space-y-2 rounded border border-border bg-muted/30 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{c.catalog.oauthClientIdLabel}</Label>
                    <Input
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{c.catalog.oauthClientSecretLabel}</Label>
                    <Input
                      type="password"
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleBuildOAuthUrl()}
                  data-testid="build-oauth-url-btn"
                >
                  {c.catalog.oauthBuildUrlButton}
                </Button>
                <div className="space-y-1">
                  <Label className="text-xs">{c.catalog.oauthRedirectLabel}</Label>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">
                    {kbId ? kbConnectorOAuthRedirectUri(kbId) : ''}
                  </p>
                </div>
                {oauthAuthorizeUrl ? (
                  <div className="space-y-2">
                    <Button type="button" size="sm" asChild data-testid="open-oauth-authorize-btn">
                      <a href={oauthAuthorizeUrl} target="_blank" rel="noopener noreferrer">
                        {c.catalog.oauthOpenAuthorize}
                      </a>
                    </Button>
                    <p className="break-all font-mono text-[11px] text-muted-foreground">
                      {oauthAuthorizeUrl}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => void handleSaveConnection()} disabled={savingConn}>
              {savingConn ? c.catalog.saving : c.catalog.saveConnection}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteMappingId !== null}
        onOpenChange={(open) => !open && setDeleteMappingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.mappings.deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{c.mappings.deleteDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{c.mappings.cancelButton}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingMappingId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (deleteMappingId) {
                  void handleDeleteMapping(deleteMappingId);
                }
              }}
              data-testid="confirm-delete-mapping-btn"
            >
              {deletingMappingId ? c.mappings.deletingMapping : c.mappings.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConsolePageLayout>
  );
}
