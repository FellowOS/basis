import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { KbChatPlayground } from '@/components/kb/widgets/kb-chat-playground.js';
import { KbMcpIntegrationPanel } from '@/components/kb/widgets/kb-mcp-integration-panel.js';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { useKbMcpIntegration } from '@/lib/use-kb-mcp-integration.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { kbPath } from '@/lib/nav-config.js';
import { api } from '@/lib/api.js';
import { useEffect, useState } from 'react';


type KbRow = { my_role: string };

export function KbChatPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const { getKb } = useKbCatalog();
  const tab = searchParams.get('tab') ?? 'playground';
  const graphFocus = searchParams.get('focus');
  const { caps } = useKbCapabilities();
  const [myRole, setMyRole] = useState<string | undefined>();
  const [tokenCreateOpen, setTokenCreateOpen] = useState(false);

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
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: name, to: `/kbs/${id}/graph` },
        { label: t.menu.kb.chat },
      ]}
      subtitle={t.pages.kbSubtitles.chat}
      meta={
        tab === 'playground' && graphFocus && caps?.graph ? (
          <span>
            {zh ? '上下文节点：' : 'Context node: '}
            <Link
              className="font-mono text-primary hover:underline"
              to={`${kbPath(id, 'graph')}?focus=${encodeURIComponent(graphFocus)}`}
            >
              {graphFocus}
            </Link>
          </span>
        ) : undefined
      }
      actions={
        tab === 'playground' && caps?.graph ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link
              to={
                graphFocus
                  ? `${kbPath(id, 'graph')}?focus=${encodeURIComponent(graphFocus)}`
                  : kbPath(id, 'graph')
              }
            >
              {zh ? '打开图谱' : 'Open graph'}
            </Link>
          </Button>
        ) : tab === 'connect' && canManageTokens ? (
          <Button type="button" size="sm" onClick={() => setTokenCreateOpen(true)}>
            {t.menu.kbMcp.createButton}
          </Button>
        ) : undefined
      }
    >
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTokenCreateOpen(false);
          setSearchParams({ tab: value }, { replace: true });
        }}
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
            canProposeRemember={caps?.graph_write === true}
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
            createOpen={tokenCreateOpen}
            onCreateOpenChange={setTokenCreateOpen}
            showCreateInCard={false}
          />
        </TabsContent>
      </Tabs>
    </ConsolePageLayout>
  );
}
