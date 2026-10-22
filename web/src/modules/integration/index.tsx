import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ApiTokensPanel } from './components/api-tokens-panel.js';
import { McpIntegrationPanel } from './components/mcp-integration-panel.js';
import { ConnectorsPlaygroundPanel } from './components/connectors-playground-panel.js';
import { OpenApiIntegrationPanel } from './components/openapi-integration-panel.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { useWorkspaceMcpIntegration } from '@/modules/integration/lib/use-mcp-integration.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { workspaceOpenApiGET } from '@/lib/openapi/client.js';

type WorkspaceRecord = { my_role: string };

type IntegrationTab = 'mcp' | 'openapi' | 'tokens' | 'connectors';

function parseIntegrationTab(raw: string | null): IntegrationTab {
  if (raw === 'mcp' || raw === 'openapi' || raw === 'tokens' || raw === 'connectors') {
    return raw;
  }
  return 'mcp';
}

export function IntegrationPage() {
  const { id } = useParams();
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
        onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="mcp">{t.integration.tabs.mcp}</TabsTrigger>
          <TabsTrigger value="openapi">{t.integration.tabs.openapi}</TabsTrigger>
          <TabsTrigger value="tokens">{t.integration.tabs.tokens}</TabsTrigger>
          <TabsTrigger value="connectors">{t.integration.tabs.connectors}</TabsTrigger>
        </TabsList>

        <TabsContent value="mcp" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <McpIntegrationPanel mcpInfo={integration.mcpInfo} onCopy={integration.copyToClipboard} />
          </div>
        </TabsContent>

        <TabsContent value="openapi" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <OpenApiIntegrationPanel workspaceId={id} />
        </TabsContent>

        <TabsContent
          value="connectors"
          className="mt-4 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <ConnectorsPlaygroundPanel workspaceId={id} />
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
