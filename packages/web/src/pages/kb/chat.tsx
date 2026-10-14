import { useParams, useSearchParams } from 'react-router-dom';
import { KbChatPlayground } from '@/components/kb-chat-playground.js';
import { KbMcpIntegrationPanel } from '@/components/kb-mcp-integration-panel.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { useKbMcpIntegration } from '@/lib/use-kb-mcp-integration.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { api } from '@/lib/api.js';
import { useEffect, useState } from 'react';

type KbRow = { my_role: string };

export function KbChatPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  const tab = searchParams.get('tab') ?? 'playground';
  const graphFocus = searchParams.get('focus');
  const { caps } = useKbCapabilities();
  const [myRole, setMyRole] = useState<string | undefined>();

  const catalogKb = id ? getKb(id) : undefined;
  const name = catalogKb?.name ?? id ?? '…';
  const canManageTokens = ['owner', 'admin'].includes(myRole ?? catalogKb?.my_role ?? '');

  const mcp = useKbMcpIntegration(id, canManageTokens);

  useEffect(() => {
    if (!id) return;
    api<KbRow>(`/api/kbs/${id}`)
      .then((kb) => setMyRole(kb.my_role))
      .catch(() => setMyRole(undefined));
  }, [id]);

  if (!id) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: name, to: `/kbs/${id}/graph` },
          { label: t.menu.kb.chat },
        ]}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="playground">{t.chat.tabPlayground}</TabsTrigger>
          <TabsTrigger value="connect">{t.chat.tabConnect}</TabsTrigger>
        </TabsList>
        <TabsContent value="playground" className="mt-4">
          <KbChatPlayground
            kbId={id}
            graphFocusId={graphFocus}
            graphEnabled={caps?.graph === true}
          />
        </TabsContent>
        <TabsContent value="connect" className="mt-4">
          <KbMcpIntegrationPanel
            mcpInfo={mcp.mcpInfo}
            apiTokens={mcp.apiTokens}
            canManageTokens={canManageTokens}
            tokenName={mcp.tokenName}
            onTokenNameChange={mcp.setTokenName}
            onCreateToken={mcp.createApiToken}
            createdSecret={mcp.createdSecret}
            onDismissCreatedSecret={mcp.clearCreatedSecret}
            onCopy={mcp.copyToClipboard}
            onDeleteToken={mcp.deleteApiToken}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
