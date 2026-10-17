import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { KbChatPlayground } from '@/components/app/kb/widgets/kb-chat-playground.js';
import { KbMcpIntegrationPanel } from '@/components/app/kb/widgets/kb-mcp-integration-panel.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Button } from '@/components/ui/button.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import { useKbMcpIntegration } from '@/lib/use-kb-mcp-integration.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

type KbRow = { my_role: string };

export function KbChatPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb } = useKbCatalog();
  const tab = searchParams.get('tab') === 'connect' ? 'connect' : 'playground';
  const graphFocus = searchParams.get('focus');
  const { caps } = useKbCapabilities();
  const [myRole, setMyRole] = useState<string | undefined>();

  const catalogKb = id ? getKb(id) : undefined;
  const name = catalogKb?.name ?? id ?? t.common.ellipsis;
  const canManageTokens = ['owner', 'admin'].includes(myRole ?? catalogKb?.my_role ?? '');

  const mcp = useKbMcpIntegration(id, canManageTokens);

  useEffect(() => {
    if (!id) return;
    kbOpenApiGET<KbRow>(id, '')
      .then((kb) => setMyRole(kb.my_role))
      .catch(() => setMyRole(undefined));
  }, [id]);

  if (!id) return null;

  function selectTab(value: 'playground' | 'connect') {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  }

  const graphHref = graphFocus
    ? `${kbPath(id, 'graph')}?focus=${encodeURIComponent(graphFocus)}`
    : kbPath(id, 'graph');

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: name, to: `/kbs/${id}/graph` },
        { label: t.menu.kb.chat },
      ]}
      className="min-h-0 overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <PublicIcon name="message-chat-01" size={13} className="shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t.menu.kb.chat}
          </span>
          {tab === 'playground' && graphFocus && caps?.graph ? (
            <Link to={graphHref} className="min-w-0 truncate font-mono text-[11px] text-foreground underline-offset-2 hover:underline">
              {graphFocus}
            </Link>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={tab === 'playground' ? 'default' : 'outline'}
              className="h-8 px-2 text-xs"
              onClick={() => selectTab('playground')}
            >
              {t.chat.tabPlayground}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === 'connect' ? 'default' : 'outline'}
              className="h-8 px-2 text-xs"
              onClick={() => selectTab('connect')}
            >
              {t.chat.tabConnect}
            </Button>
            {tab === 'playground' && caps?.graph ? (
              <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" asChild>
                <Link to={graphHref}>{t.chat.graphLink}</Link>
              </Button>
            ) : null}
          </div>
        </div>
        {tab === 'playground' ? (
          <KbChatPlayground
            kbId={id}
            graphFocusId={graphFocus}
            graphEnabled={caps?.graph === true}
            canProposeRemember={caps?.graph_write === true}
          />
        ) : (
          <KbMcpIntegrationPanel
            mcpInfo={mcp.mcpInfo}
            apiTokens={mcp.apiTokens}
            canManageTokens={canManageTokens}
            onCreateToken={mcp.createApiToken}
            createdSecret={mcp.createdSecret}
            onDismissCreatedSecret={mcp.clearCreatedSecret}
            onCopy={mcp.copyToClipboard}
            onDeleteToken={mcp.deleteApiToken}
          />
        )}
      </div>
    </ConsolePageLayout>
  );
}
