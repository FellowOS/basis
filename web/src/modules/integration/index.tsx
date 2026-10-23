import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiTokensPanel } from './components/api-tokens-panel.js';
import { McpIntegrationPanel } from './components/mcp-integration-panel.js';
import { OpenApiIntegrationPanel } from './components/openapi-integration-panel.js';
import { workspaceConnectorsAuthorizationHref } from '@/modules/connectors/lib/playground-deep-link.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { useWorkspaceMcpIntegration } from '@/modules/integration/lib/use-mcp-integration.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { workspaceOpenApiGET } from '@/lib/openapi/client.js';

type WorkspaceRecord = { my_role: string };

type IntegrationTab = 'mcp' | 'openapi' | 'tokens';

function parseIntegrationTab(raw: string | null): IntegrationTab {
  if (raw === 'mcp' || raw === 'openapi' || raw === 'tokens') {
    return raw;
  }
  return 'mcp';
}

export function IntegrationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { getWorkspace } = useWorkspaceCatalog();
  const [myRole, setMyRole] = useState<string | undefined>();

  const tab = parseIntegrationTab(searchParams.get('tab'));

  const catalogKb = id ? getWorkspace(id) : undefined;
  const name = catalogKb?.name ?? id ?? t.core.common.ellipsis;
  const canManageTokens = ['owner', 'admin'].includes(myRole ?? catalogKb?.my_role ?? '');

  const integration = useWorkspaceMcpIntegration(id, canManageTokens);

  useEffect(() => {
    if (!id) return;
    workspaceOpenApiGET<WorkspaceRecord>(id, '')
      .then((workspace) => setMyRole(workspace.my_role))
      .catch(() => setMyRole(undefined));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (searchParams.get('tab') !== 'connectors') return;
    navigate(
      workspaceConnectorsAuthorizationHref(id, {
        subjectId: searchParams.get('subject_id') ?? undefined,
        service: searchParams.get('service') ?? undefined,
      }),
      { replace: true },
    );
  }, [id, navigate, searchParams]);

  if (!id) return null;

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.core.workspace_nav.platform.workspaces, to: '/workspaces' },
        { label: name, to: `/workspaces/${id}/graph` },
        { label: t.integration.menu.integration },
      ]}
      className="min-h-0 overflow-hidden"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          next.set('tab', value);
          setSearchParams(next, { replace: true });
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="mcp">{t.integration.tabs.mcp}</TabsTrigger>
          <TabsTrigger value="openapi">{t.integration.tabs.openapi}</TabsTrigger>
          <TabsTrigger value="tokens">{t.integration.tabs.tokens}</TabsTrigger>
        </TabsList>

        <TabsContent value="mcp" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <McpIntegrationPanel mcpInfo={integration.mcpInfo} onCopy={integration.copyToClipboard} />
          </div>
        </TabsContent>

        <TabsContent value="openapi" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <OpenApiIntegrationPanel workspaceId={id} />
        </TabsContent>

        <TabsContent value="tokens" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <ApiTokensPanel
            apiTokens={integration.apiTokens}
            canManageTokens={canManageTokens}
            onCreateToken={integration.createApiToken}
            createdSecret={integration.createdSecret}
            onDismissCreatedSecret={integration.clearCreatedSecret}
            onCopy={integration.copyToClipboard}
            onDeleteToken={integration.deleteApiToken}
          />
        </TabsContent>
      </Tabs>
    </ConsolePageLayout>
  );
}
