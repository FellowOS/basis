import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { KbApiTokensPanel } from '@/components/app/kb/widgets/kb-api-tokens-panel.js';
import { KbMcpIntegrationPanel } from '@/components/app/kb/widgets/kb-mcp-integration-panel.js';
import { KbOpenApiIntegrationPanel } from '@/components/app/kb/widgets/kb-openapi-integration-panel.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { useKbMcpIntegration } from '@/lib/use-kb-mcp-integration.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

type KbRow = { my_role: string };

type IntegrationTab = 'mcp' | 'openapi' | 'tokens';

function parseIntegrationTab(raw: string | null): IntegrationTab {
  if (raw === 'mcp' || raw === 'openapi' || raw === 'tokens') return raw;
  return 'mcp';
}

export function KbIntegrationPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  const [myRole, setMyRole] = useState<string | undefined>();

  const tab = parseIntegrationTab(searchParams.get('tab'));

  const catalogKb = id ? getKb(id) : undefined;
  const name = catalogKb?.name ?? id ?? t.common.ellipsis;
  const canManageTokens = ['owner', 'admin'].includes(myRole ?? catalogKb?.my_role ?? '');

  const integration = useKbMcpIntegration(id, canManageTokens);

  useEffect(() => {
    if (!id) return;
    kbOpenApiGET<KbRow>(id, '')
      .then((kb) => setMyRole(kb.my_role))
      .catch(() => setMyRole(undefined));
  }, [id]);

  if (!id) return null;

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: name, to: `/kbs/${id}/graph` },
        { label: t.menu.kb.integration },
      ]}
      className="min-h-0 overflow-hidden"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="mcp">{t.menu.kbIntegration.tabs.mcp}</TabsTrigger>
          <TabsTrigger value="openapi">{t.menu.kbIntegration.tabs.openapi}</TabsTrigger>
          <TabsTrigger value="tokens">{t.menu.kbIntegration.tabs.tokens}</TabsTrigger>
        </TabsList>

        <TabsContent value="mcp" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <KbMcpIntegrationPanel mcpInfo={integration.mcpInfo} onCopy={integration.copyToClipboard} />
          </div>
        </TabsContent>

        <TabsContent value="openapi" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <KbOpenApiIntegrationPanel kbId={id} />
        </TabsContent>

        <TabsContent value="tokens" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
          <KbApiTokensPanel
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
