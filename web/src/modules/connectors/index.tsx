import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Switch } from '@/components/ui/switch.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleDateTime } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/errors/api-error-message.js';
import { ConnectorConnectAuthFields } from '@/modules/connectors/components/connector-connect-auth-fields.js';
import { ConnectorMappingCreateDialog } from '@/modules/connectors/components/connector-mapping-create-dialog.js';
import {
  workspaceConnectorMappingEditPath,
  workspaceConnectorMappingNewPath,
  workspaceConnectionsByService,
  type StoredConnection,
} from '@/modules/connectors/lib/connector-connections.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import {
  type ConnectorPanel,
  workspaceConnectorPanelPath,
  workspacePath,
} from '@/lib/nav/nav-config.js';
import {
  workspaceOpenApiDELETE,
  workspaceOpenApiGET,
  workspaceOpenApiPOST,
  workspaceOpenApiPUT,
} from '@/lib/openapi/client.js';
import { resourceCardSurfaceClass } from '@/lib/ui-classes/card-surface.js';
import {
  connectorAuthNeedsPkce,
  generateOAuthState,
  generatePkcePair,
  workspaceConnectorOAuthRedirectUri,
  savePendingConnectorOAuth,
} from '@/modules/connectors/lib/connector-oauth.js';
import { cn } from '@/lib/utils.js';
import {
  authModeDisplayLabel,
  connectorAuthCatalogEntries,
  findAuthCatalogEntry,
} from '@/modules/connectors/lib/connector-auth-display.js';
import {
  authCredentialFieldsAreBlank,
  authFieldDefaultValues,
  authFieldValuesFromObject,
  buildObjectFromAuthFields,
  hasStructuredAuthForm,
  isOAuth2ConnectManifestOnly,
  parsedCredentialJsonIsBlank,
  type ConnectorAuthCatalogEntry,
} from '@/modules/connectors/lib/connector-auth-fields.js';
import {
  authModesForConnector,
  defaultConnectorConfigForAuth,
  defaultConnectorCredentialsForAuth,
  formatConnectorConnectJson,
} from '@/modules/connectors/lib/connector-connect-defaults.js';

type CatalogConnector = {
  service: string;
  display_name: string;
  description?: string;
  categories?: string[];
  auth?: ConnectorAuthCatalogEntry[];
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
export function ConnectorsRedirect() {
  const { id: workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const panel = parseConnectorPanel(searchParams.get('tab') ?? undefined);
  if (!workspaceId) return null;
  return <Navigate to={workspaceConnectorPanelPath(workspaceId, panel ?? 'catalog')} replace />;
}

export function ConnectorsPage() {
  const { id: workspaceId, panel: panelParam } = useParams<{ id: string; panel: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const c = t.connectors.page;
  const { getWorkspace } = useWorkspaceCatalog();

  const panel = parseConnectorPanel(panelParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [streamsOnly, setStreamsOnly] = useState(true);

  const [catalogStats, setCatalogStats] = useState({ providers: 0, providers_with_streams: 0 });
  const [connectors, setConnectors] = useState<CatalogConnector[]>([]);
  const [connections, setConnections] = useState<StoredConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
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
  const [connConfigFieldValues, setConnConfigFieldValues] = useState<Record<string, string>>(
    {},
  );
  const [connCredFieldValues, setConnCredFieldValues] = useState<Record<string, string>>({});
  const [connectFormUseJson, setConnectFormUseJson] = useState(false);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthHasSavedSecret, setOauthHasSavedSecret] = useState(false);
  const [oauthAuthorizeUrl, setOauthAuthorizeUrl] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<StoredConnection | null>(null);
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
  const [createMappingOpen, setCreateMappingOpen] = useState(false);
  const [createMappingInitialTab, setCreateMappingInitialTab] = useState<'auto' | 'manual'>('auto');

  const configuredByService = useMemo(
    () => workspaceConnectionsByService(connections),
    [connections],
  );

  const loadCatalogAndConnections = useCallback(async () => {
    if (!workspaceId) return;
    setConnectionsLoading(true);
    try {
      const [catRes, connRes] = await Promise.all([
        workspaceOpenApiGET<{
          stats: { providers: number; providers_with_streams: number };
          connectors: CatalogConnector[];
        }>(workspaceId, 'connectors/catalog', {
          params: {
            query: {
              has_streams_only: streamsOnly,
              query: searchQuery.trim() || undefined,
              limit: 60,
            },
          },
        }),
        workspaceOpenApiGET<{ connections: StoredConnection[] }>(workspaceId, 'connectors/connections'),
      ]);
      setCatalogStats(catRes.stats);
      setConnectors(catRes.connectors ?? []);
      setConnections(connRes.connections ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setConnectionsLoading(false);
    }
  }, [workspaceId, streamsOnly, searchQuery, locale]);

  const loadMappings = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await workspaceOpenApiGET<{ mappings: TableMappingDto[] }>(
        workspaceId,
        'connectors/table-mappings',
      );
      setMappings(res.mappings ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }, [workspaceId, locale]);

  const loadPolicyAndOutbox = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [polRes, outRes] = await Promise.all([
        workspaceOpenApiGET<{
          platform_allowed_providers: string[] | string;
          allowed_providers: string[] | string;
          effective_allowed_providers: string[] | string;
          action_policy: Record<string, unknown>;
        }>(workspaceId, 'connectors/policy'),
        workspaceOpenApiGET<{ items: OutboxItemDto[] }>(workspaceId, 'connectors/outbox'),
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
  }, [workspaceId, locale]);

  const loadRuns = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await workspaceOpenApiGET<{ runs: ConnectorRunDto[] }>(workspaceId, 'connectors/runs');
      setRuns(res.runs ?? []);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }, [workspaceId, locale]);

  useEffect(() => {
    void loadCatalogAndConnections();
  }, [loadCatalogAndConnections]);

  useEffect(() => {
    if (panel === 'mappings') void loadMappings();
    if (panel === 'policy') void loadPolicyAndOutbox();
    if (panel === 'runs') void loadRuns();
  }, [panel, loadMappings, loadPolicyAndOutbox, loadRuns]);

  useEffect(() => {
    if (panel !== 'mappings' || searchParams.get('suggest') !== '1') {
      return;
    }
    setCreateMappingInitialTab('auto');
    setCreateMappingOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('suggest');
    setSearchParams(next, { replace: true });
  }, [panel, searchParams, setSearchParams]);

  function openCreateMapping(tab: 'auto' | 'manual' = 'auto') {
    setCreateMappingInitialTab(tab);
    setCreateMappingOpen(true);
  }

  function goToNewMapping(prefill?: StoredConnection) {
    if (!workspaceId) return;
    navigate(
      workspaceConnectorMappingNewPath(workspaceId, {
        service: prefill?.service,
        connectionName: prefill?.connection_name,
      }),
    );
  }

  function resetOAuthClientFields() {
    setOauthClientId('');
    setOauthClientSecret('');
    setOauthHasSavedSecret(false);
  }

  function applyConnectFormForAuth(item: CatalogConnector, authMode: string) {
    const entry = findAuthCatalogEntry(item.auth, authMode);
    setConnectFormUseJson(false);
    if (hasStructuredAuthForm(entry)) {
      setConnConfigFieldValues(authFieldDefaultValues(entry?.connection_config));
      setConnCredFieldValues(authFieldDefaultValues(entry?.credentials));
      setConnConfigJson(
        formatConnectorConnectJson(
          buildObjectFromAuthFields(entry?.connection_config, authFieldDefaultValues(entry?.connection_config)),
        ),
      );
      setConnCredsJson(
        formatConnectorConnectJson(
          buildObjectFromAuthFields(entry?.credentials, authFieldDefaultValues(entry?.credentials)),
        ),
      );
    } else {
      setConnConfigFieldValues({});
      setConnCredFieldValues({});
      setConnConfigJson(
        formatConnectorConnectJson(defaultConnectorConfigForAuth(item.service, authMode)),
      );
      setConnCredsJson(
        formatConnectorConnectJson(defaultConnectorCredentialsForAuth(item.service, authMode)),
      );
    }
  }

  function applyConnectFormFromConnection(
    item: CatalogConnector,
    authMode: string,
    existing: StoredConnection,
  ) {
    const entry = findAuthCatalogEntry(item.auth, authMode);
    const cfg = existing.connection_config ?? {};
    setConnectFormUseJson(false);
    if (hasStructuredAuthForm(entry)) {
      setConnConfigFieldValues(authFieldValuesFromObject(entry?.connection_config, cfg));
      setConnCredFieldValues(authFieldDefaultValues(entry?.credentials));
      setConnConfigJson(
        formatConnectorConnectJson(
          buildObjectFromAuthFields(
            entry?.connection_config,
            authFieldValuesFromObject(entry?.connection_config, cfg),
          ),
        ),
      );
      setConnCredsJson(formatConnectorConnectJson({}));
    } else {
      setConnConfigFieldValues({});
      setConnCredFieldValues({});
      setConnConfigJson(formatConnectorConnectJson(cfg));
      setConnCredsJson(formatConnectorConnectJson({}));
    }
  }

  async function loadOAuthConfigForService(service: string) {
    if (!workspaceId) return;
    resetOAuthClientFields();
    try {
      const res = await workspaceOpenApiGET<{
        oauth_config: {
          client_id?: string;
          has_client_secret?: boolean;
        };
      }>(workspaceId, `connectors/oauth-configs/${service}`);
      if (res.oauth_config?.client_id) {
        setOauthClientId(res.oauth_config.client_id);
      }
      setOauthHasSavedSecret(Boolean(res.oauth_config?.has_client_secret));
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 405 || status === 404) {
        return;
      }
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }

  function closeConnectDialog() {
    setSelectedConnector(null);
    setEditingConnection(null);
    setOauthAuthorizeUrl(null);
    resetOAuthClientFields();
  }

  function beginConnectorConnect(item: CatalogConnector, preferredAuthMode?: string) {
    const modes = authModesForConnector(item.auth);
    const mode =
      preferredAuthMode && modes.includes(preferredAuthMode) ? preferredAuthMode : modes[0];
    setEditingConnection(null);
    setSelectedConnector(item);
    setConnName('default');
    setConnAuthMode(mode);
    setOauthAuthorizeUrl(null);
    resetOAuthClientFields();
    applyConnectFormForAuth(item, mode);
    void loadOAuthConfigForService(item.service);
  }

  function beginConnectorEdit(item: CatalogConnector, existing: StoredConnection) {
    const modes = authModesForConnector(item.auth);
    const mode = modes.includes(existing.auth_type) ? existing.auth_type : modes[0];
    setEditingConnection(existing);
    setSelectedConnector(item);
    setConnName(existing.connection_name);
    setConnAuthMode(mode);
    setOauthAuthorizeUrl(null);
    applyConnectFormFromConnection(item, mode, existing);
    void loadOAuthConfigForService(item.service);
  }

  function handleConnectAuthModeChange(authMode: string) {
    if (!selectedConnector) return;
    setConnAuthMode(authMode);
    setOauthAuthorizeUrl(null);
    if (editingConnection) {
      applyConnectFormFromConnection(selectedConnector, authMode, editingConnection);
    } else {
      applyConnectFormForAuth(selectedConnector, authMode);
    }
  }

  const connectAuthEntries = selectedConnector
    ? connectorAuthCatalogEntries(selectedConnector.auth)
    : [];
  const connectAuthEntry = selectedConnector
    ? findAuthCatalogEntry(selectedConnector.auth, connAuthMode)
    : undefined;
  const connectUsesStructuredFields =
    Boolean(connectAuthEntry && hasStructuredAuthForm(connectAuthEntry) && !connectFormUseJson);
  const oauth2ManifestOnly = isOAuth2ConnectManifestOnly(connectAuthEntry);
  const authModeLabels = c.catalog.auth_modes;

  function labelForAuthMode(
    item: CatalogConnector | null,
    authMode: string,
  ): string {
    const entry = findAuthCatalogEntry(item?.auth, authMode);
    return authModeDisplayLabel(authMode, entry?.display_name, authModeLabels);
  }

  if (!workspaceId) return null;

  async function handleSaveConnection() {
    if (!workspaceId || !selectedConnector) return;
    setSavingConn(true);
    try {
      let cfg: Record<string, unknown>;
      let creds: Record<string, unknown>;
      if (connectUsesStructuredFields && connectAuthEntry) {
        cfg = buildObjectFromAuthFields(
          connectAuthEntry.connection_config,
          connConfigFieldValues,
        );
        creds = buildObjectFromAuthFields(connectAuthEntry.credentials, connCredFieldValues);
      } else {
        cfg = JSON.parse(connConfigJson || '{}') as Record<string, unknown>;
        creds = JSON.parse(connCredsJson || '{}') as Record<string, unknown>;
      }
      const credsBlank =
        connectUsesStructuredFields && connectAuthEntry
          ? authCredentialFieldsAreBlank(connectAuthEntry.credentials, connCredFieldValues)
          : parsedCredentialJsonIsBlank(connCredsJson);
      await workspaceOpenApiPUT(
        workspaceId,
        `connectors/connections/${selectedConnector.service}/${connName.trim() || 'default'}`,
        {
          body: {
            auth_type: connAuthMode,
            connection_config: cfg,
            credentials: credsBlank ? {} : creds,
          },
        },
      );
      closeConnectDialog();
      await loadCatalogAndConnections();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setSavingConn(false);
    }
  }

  async function handleCheckConnection(service: string, name: string) {
    if (!workspaceId) return;
    const key = `${service}:${name}`;
    setCheckingKey(key);
    try {
      await workspaceOpenApiPOST(workspaceId, `connectors/connections/${service}/${name}/check`);
      toast.success(c.catalog.check_success);
      await loadCatalogAndConnections();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setCheckingKey(null);
    }
  }

  async function handleDeleteConnection(service: string, name: string) {
    if (!workspaceId) return;
    try {
      await workspaceOpenApiDELETE(workspaceId, `connectors/connections/${service}/${name}`);
      await loadCatalogAndConnections();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }

  async function handleDeleteMapping(mappingId: string) {
    if (!workspaceId) return;
    setDeletingMappingId(mappingId);
    try {
      await workspaceOpenApiDELETE(workspaceId, `connectors/table-mappings/${mappingId}`);
      toast.success(c.mappings.deleted_toast);
      setDeleteMappingId(null);
      await loadMappings();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    } finally {
      setDeletingMappingId(null);
    }
  }

  async function handleSyncMapping(mappingId: string) {
    if (!workspaceId) return;
    setSyncingId(mappingId);
    try {
      const stats = await workspaceOpenApiPOST<{
        fetched_rows: number;
        added: number;
        updated: number;
        unchanged: number;
        deleted: number;
      }>(workspaceId, `connectors/table-mappings/${mappingId}/sync`);
      toast.success(
        fmt(c.mappings.sync_result_summary, {
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
    if (!workspaceId) return;
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
      await workspaceOpenApiPUT(workspaceId, 'connectors/policy', {
        body: {
          allowed_providers: allowed,
          action_policy: actionPolicy,
        },
      });
      toast.success(c.policy.saved_toast);
      await loadPolicyAndOutbox();
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }

  async function handleBuildOAuthUrl() {
    if (!workspaceId || !selectedConnector) return;
    if (!oauthClientId.trim() || (!oauthClientSecret.trim() && !oauthHasSavedSecret)) {
      toast.error(c.catalog.oauth_client_required);
      return;
    }
    try {
      const redirectUri = workspaceConnectorOAuthRedirectUri(workspaceId);
      await workspaceOpenApiPUT(workspaceId, `connectors/oauth-configs/${selectedConnector.service}`, {
        body: {
          client_id: oauthClientId.trim(),
          client_secret: oauthClientSecret.trim() || null,
          redirect_uri: redirectUri,
        },
      });
      setOauthHasSavedSecret(true);
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
      const res = await workspaceOpenApiPOST<{ authorize_url: string; state: string }>(
        workspaceId,
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
        workspaceId,
        service: selectedConnector.service,
        connectionName: connName.trim() || 'default',
        connectionConfig: cfg,
        state: res.state ?? state,
        redirectUri,
        codeVerifier,
      });
      setOauthAuthorizeUrl(res.authorize_url);
      toast.success(c.catalog.oauth_url_generated);
    } catch (err) {
      toast.error(formatUserFacingApiError(err, locale as Locale));
    }
  }

  async function handleRunTool() {
    if (!workspaceId) return;
    setRunningTool(true);
    try {
      const args = JSON.parse(toolArgsJson || '{}') as Record<string, unknown>;
      const res = await workspaceOpenApiPOST(workspaceId, 'connectors/tools/execute', {
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
    return workspaceId ? <Navigate to={workspaceConnectorPanelPath(workspaceId, 'catalog')} replace /> : null;
  }

  const panelCrumbLabel =
    panel === 'catalog'
      ? t.connectors.menu.connector_catalog
      : panel === 'mappings'
        ? t.connectors.menu.connector_stream_mappings
        : panel === 'policy'
          ? t.connectors.menu.connector_action_policy
          : t.connectors.menu.connector_run_logs;

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.core.workspace_nav.platform.workspaces, to: '/workspaces' },
        { label: getWorkspace(workspaceId)?.name ?? workspaceId, to: workspacePath(workspaceId!, 'graph') },
        { label: t.core.workspace_nav.workspace_zones.connectors, to: workspaceConnectorPanelPath(workspaceId!, 'catalog') },
        { label: panelCrumbLabel },
      ]}
      subtitle={t.connectors.page.subtitle}
    >
      {panel === 'catalog' ? (
        <div className="space-y-4" data-testid="connectors-panel-catalog">
          <DataPanel>
            <DataPanelHeader title={c.catalog.configured_title} />
            <DataPanelBody padded={false}>
              {connections.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  {c.catalog.configured_empty}
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
                            variant="outline"
                            onClick={() => {
                              const catalogItem = connectors.find((c) => c.service === conn.service);
                              if (catalogItem) {
                                beginConnectorEdit(catalogItem, conn);
                              } else {
                                toast.error(c.catalog.edit_catalog_missing);
                              }
                            }}
                            data-testid={`edit-connection-${conn.service}-${conn.connection_name}`}
                          >
                            {c.catalog.edit_button}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => goToNewMapping(conn)}
                            data-testid={`create-mapping-from-connection-${conn.service}-${conn.connection_name}`}
                          >
                            <PublicIcon name="plus-01" size={14} className="mr-1" />
                            {c.catalog.create_mapping_button}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={checkingKey === key}
                            onClick={() => void handleCheckConnection(conn.service, conn.connection_name)}
                          >
                            {checkingKey === key ? c.catalog.checking : c.catalog.check_button}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDeleteConnection(conn.service, conn.connection_name)}
                          >
                            {c.catalog.delete_button}
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
              title={c.catalog.directory_title}
              subtitle={fmt(c.catalog.stats_summary, {
                providers: catalogStats.providers,
                withStreams: catalogStats.providers_with_streams,
              })}
            />
            <DataPanelBody padded={false}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={c.catalog.search_placeholder}
                  className="max-w-md"
                  data-testid="connectors-catalog-search"
                />
                <div className="flex items-center gap-2 text-xs">
                  <Switch
                    id="streams-only-switch"
                    checked={streamsOnly}
                    onCheckedChange={setStreamsOnly}
                  />
                  <Label htmlFor="streams-only-switch">{c.catalog.streams_only_filter}</Label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
                {connectors.map((item) => {
                  const firstAuthEntry = connectorAuthCatalogEntries(item.auth)[0];
                  const firstAuth = firstAuthEntry.auth_mode;
                  const firstAuthLabel = authModeDisplayLabel(
                    firstAuth,
                    firstAuthEntry.display_name,
                    authModeLabels,
                  );
                  const configuredForService = configuredByService.get(item.service) ?? [];
                  return (
                    <div
                      key={item.service}
                      className={cn(resourceCardSurfaceClass, 'flex flex-col justify-between gap-3 p-3.5')}
                      data-testid={`catalog-connector-card-${item.service}`}
                      data-configured={configuredForService.length > 0 ? 'true' : 'false'}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm text-foreground">
                            {item.display_name}
                          </span>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                            {configuredForService.length > 0 ? (
                              <Badge
                                variant="outline"
                                className="badge-status-success text-[10px]"
                                data-testid={`catalog-connector-configured-${item.service}`}
                              >
                                {c.catalog.configured_card_badge}
                              </Badge>
                            ) : null}
                            <Badge variant="secondary" className="text-[10px]">
                              {firstAuthLabel}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        {configuredForService.length > 0 ? (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            {fmt(c.catalog.configured_card_connections, {
                              count: configuredForService.length,
                              names: configuredForService
                                .map((conn) => conn.connection_name)
                                .join(', '),
                            })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>
                            {fmt(c.catalog.streams_badge, { count: item.streams?.length ?? 0 })}
                          </span>
                          <span>·</span>
                          <span>
                            {fmt(c.catalog.tools_badge, { count: item.tools?.length ?? 0 })}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => beginConnectorConnect(item)}
                          data-testid={`connect-btn-${item.service}`}
                        >
                          <PublicIcon name="plug-01" size={14} className="mr-1" />
                          {c.catalog.connect_button}
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
                  onClick={() => openCreateMapping('auto')}
                  data-testid="create-table-mapping-btn"
                >
                  <PublicIcon name="plus-01" size={14} className="mr-1" />
                  {c.mappings.create_button}
                </Button>
              }
            />
            <DataPanelBody padded={false}>
              {mappings.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">{c.mappings.empty_title}</p>
                  <p className="max-w-md text-xs text-muted-foreground">{c.mappings.empty_description}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => openCreateMapping('auto')}
                      data-testid="create-table-mapping-empty-btn"
                    >
                      <PublicIcon name="plus-01" size={14} className="mr-1" />
                      {c.mappings.create_button}
                    </Button>
                    {connections.length === 0 ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={workspaceConnectorPanelPath(workspaceId, 'catalog')}>
                          {c.mappings.empty_open_catalog}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
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
                            ? fmt(c.mappings.direction_bidirectional, { mode: m.writeback_mode })
                            : c.mappings.direction_inbound}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            to={workspaceConnectorMappingEditPath(workspaceId, m.id)}
                            data-testid={`edit-mapping-btn-${m.id}`}
                          >
                            {c.mappings.edit_button}
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteMappingId(m.id)}
                          data-testid={`delete-mapping-btn-${m.id}`}
                        >
                          {c.mappings.delete_button}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={syncingId === m.id}
                          onClick={() => void handleSyncMapping(m.id)}
                          data-testid={`sync-mapping-btn-${m.id}`}
                        >
                          <PublicIcon name="sync" size={14} className="mr-1" />
                          {syncingId === m.id ? c.mappings.syncing : c.mappings.sync_button}
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
                  <Label>{c.policy.platform_allowed_label}</Label>
                  <Input
                    value={platformAllowedDisplay}
                    readOnly
                    className="bg-muted/40"
                    data-testid="policy-platform-allowed-providers"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{c.policy.allowed_providers_label}</Label>
                  <Input
                    value={allowedProvidersInput}
                    onChange={(e) => setAllowedProvidersInput(e.target.value)}
                    data-testid="policy-allowed-providers-input"
                  />
                  <p className="text-xs text-muted-foreground">{c.policy.allowed_providers_hint}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{c.policy.effective_allowed_label}</Label>
                  <Input
                    value={effectiveAllowedDisplay}
                    readOnly
                    className="bg-muted/40 font-mono text-xs"
                    data-testid="policy-effective-allowed-providers"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{c.policy.action_policy_label}</Label>
                  <JsonEditor
                    height={140}
                    value={actionPolicyInput}
                    onChange={setActionPolicyInput}
                  />
                </div>
                <Button size="sm" onClick={() => void handleSavePolicy()} data-testid="save-connector-policy-btn">
                  {c.policy.save_policy}
                </Button>
              </div>
            </DataPanelBody>
          </DataPanel>

          <DataPanel>
            <DataPanelHeader title={c.policy.outbox_title} />
            <DataPanelBody padded={false}>
              {outboxItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{c.policy.outbox_empty}</p>
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
            <DataPanelHeader title={c.policy.tool_runner_title} />
            <DataPanelBody>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{c.policy.tool_service_label}</Label>
                  <Input
                    value={toolService}
                    onChange={(e) => setToolService(e.target.value)}
                    data-testid="tool-runner-service-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{c.policy.tool_id_label}</Label>
                  <Input
                    value={toolId}
                    onChange={(e) => setToolId(e.target.value)}
                    data-testid="tool-runner-id-input"
                  />
                </div>
                <div className="col-span-full space-y-1">
                  <Label>{c.policy.tool_args_label}</Label>
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
                    {runningTool ? c.policy.running_tool : c.policy.run_tool_button}
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
                          {run.ok ? c.runs.status_ok : c.runs.status_failed}
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
      <Dialog
        open={Boolean(selectedConnector)}
        onOpenChange={(o) => {
          if (!o) closeConnectDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingConnection
                ? fmt(c.catalog.dialog_edit_title, {
                    name: selectedConnector?.display_name ?? '',
                    connection: editingConnection.connection_name,
                  })
                : fmt(c.catalog.dialog_title, { name: selectedConnector?.display_name ?? '' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{c.catalog.connection_name_label}</Label>
              <Input
                value={connName}
                onChange={(e) => setConnName(e.target.value)}
                readOnly={Boolean(editingConnection)}
                disabled={Boolean(editingConnection)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="connector-connect-auth-mode">{c.catalog.auth_mode_label}</Label>
              <Select value={connAuthMode} onValueChange={handleConnectAuthModeChange}>
                <SelectTrigger
                  id="connector-connect-auth-mode"
                  data-testid="connector-connect-auth-mode"
                  className="w-full"
                >
                  <SelectValue placeholder={c.catalog.auth_mode_placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {connectAuthEntries.map((entry) => (
                    <SelectItem key={entry.auth_mode} value={entry.auth_mode}>
                      {labelForAuthMode(selectedConnector, entry.auth_mode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {connectUsesStructuredFields &&
            (connectAuthEntry?.connection_config?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <Label>{c.catalog.connection_params_label}</Label>
                <ConnectorConnectAuthFields
                  idPrefix="config"
                  fields={connectAuthEntry!.connection_config!}
                  values={connConfigFieldValues}
                  onChange={(key, value) =>
                    setConnConfigFieldValues((prev) => ({ ...prev, [key]: value }))
                  }
                />
              </div>
            ) : !connectUsesStructuredFields && !oauth2ManifestOnly ? (
              <div className="space-y-1">
                <Label>{c.catalog.config_json_label}</Label>
                <JsonEditor
                  height={120}
                  value={connConfigJson}
                  onChange={setConnConfigJson}
                />
              </div>
            ) : null}
            {oauth2ManifestOnly && editingConnection ? (
              <div
                className="space-y-1 rounded border border-border bg-muted/20 px-3 py-2 text-xs"
                data-testid="connector-edit-oauth-status"
              >
                <p className="font-medium text-foreground">{c.catalog.oauth_edit_status_title}</p>
                <p className="text-muted-foreground">
                  {editingConnection.has_credentials
                    ? c.catalog.oauth_edit_token_saved
                    : c.catalog.oauth_edit_token_missing}
                </p>
                {editingConnection.updated_at ? (
                  <p className="text-muted-foreground">
                    {fmt(c.catalog.edit_updated_at, {
                      time: formatLocaleDateTime(locale as Locale, editingConnection.updated_at),
                    })}
                  </p>
                ) : null}
                <p className="text-muted-foreground">{c.catalog.oauth_edit_manifest_hint}</p>
              </div>
            ) : null}
            {connectUsesStructuredFields &&
            (connectAuthEntry?.credentials?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <Label>{c.catalog.credentials_fields_label}</Label>
                <p className="text-xs text-muted-foreground">
                  {editingConnection
                    ? c.catalog.credentials_keep_hint
                    : c.catalog.credentials_fields_hint}
                </p>
                <ConnectorConnectAuthFields
                  idPrefix="cred"
                  fields={connectAuthEntry!.credentials!}
                  values={connCredFieldValues}
                  onChange={(key, value) =>
                    setConnCredFieldValues((prev) => ({ ...prev, [key]: value }))
                  }
                />
              </div>
            ) : !connectUsesStructuredFields && !oauth2ManifestOnly ? (
              <div className="space-y-1">
                <Label>{c.catalog.credentials_json_label}</Label>
                <JsonEditor
                  height={120}
                  value={connCredsJson}
                  onChange={setConnCredsJson}
                />
              </div>
            ) : null}
            {connectAuthEntry && hasStructuredAuthForm(connectAuthEntry) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-0 text-xs text-muted-foreground"
                onClick={() => {
                  setConnectFormUseJson((useJson) => {
                    const next = !useJson;
                    if (next && connectAuthEntry) {
                      setConnConfigJson(
                        formatConnectorConnectJson(
                          buildObjectFromAuthFields(
                            connectAuthEntry.connection_config,
                            connConfigFieldValues,
                          ),
                        ),
                      );
                      setConnCredsJson(
                        formatConnectorConnectJson(
                          buildObjectFromAuthFields(
                            connectAuthEntry.credentials,
                            connCredFieldValues,
                          ),
                        ),
                      );
                    }
                    return next;
                  });
                }}
              >
                {c.catalog.advanced_json_toggle}
              </Button>
            ) : null}
            {connectFormUseJson && connectAuthEntry && hasStructuredAuthForm(connectAuthEntry) ? (
              <>
                <div className="space-y-1">
                  <Label>{c.catalog.config_json_label}</Label>
                  <JsonEditor
                    height={100}
                    value={connConfigJson}
                    onChange={setConnConfigJson}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{c.catalog.credentials_json_label}</Label>
                  <JsonEditor
                    height={100}
                    value={connCredsJson}
                    onChange={setConnCredsJson}
                  />
                </div>
              </>
            ) : null}
            {connAuthMode === 'oauth2' && (
              <div className="space-y-2 rounded border border-border bg-muted/30 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{c.catalog.oauth_client_id_label}</Label>
                    <Input
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{c.catalog.oauth_client_secret_label}</Label>
                    <Input
                      type="password"
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                      className="h-8 text-xs"
                    />
                    {oauthHasSavedSecret ? (
                      <p className="text-[11px] text-muted-foreground">
                        {c.catalog.oauth_secret_keep_hint}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleBuildOAuthUrl()}
                  data-testid="build-oauth-url-btn"
                >
                  {c.catalog.oauth_build_url_button}
                </Button>
                <div className="space-y-1">
                  <Label className="text-xs">{c.catalog.oauth_redirect_label}</Label>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">
                    {workspaceId ? workspaceConnectorOAuthRedirectUri(workspaceId) : ''}
                  </p>
                </div>
                {oauthAuthorizeUrl ? (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      size="sm"
                      data-testid="open-oauth-authorize-btn"
                      onClick={() => {
                        window.location.assign(oauthAuthorizeUrl);
                      }}
                    >
                      {c.catalog.oauth_open_authorize}
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
              {savingConn ? c.catalog.saving : c.catalog.save_connection}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {workspaceId ? (
        <ConnectorMappingCreateDialog
          workspaceId={workspaceId}
          open={createMappingOpen}
          onOpenChange={setCreateMappingOpen}
          initialTab={createMappingInitialTab}
          connections={connections}
          connectionsLoading={connectionsLoading}
          onManualContinue={(conn) => goToNewMapping(conn ?? undefined)}
          onApplied={() => void loadMappings()}
        />
      ) : null}

      <AlertDialog
        open={deleteMappingId !== null}
        onOpenChange={(open) => !open && setDeleteMappingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.mappings.delete_dialog_title}</AlertDialogTitle>
            <AlertDialogDescription>{c.mappings.delete_dialog_description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{c.mappings.cancel_button}</AlertDialogCancel>
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
              {deletingMappingId ? c.mappings.deleting_mapping : c.mappings.delete_confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConsolePageLayout>
  );
}
