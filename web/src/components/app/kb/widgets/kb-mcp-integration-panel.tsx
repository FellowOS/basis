import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';

export type McpIntegrationInfo = {
  mcp_url: string;
  tools: string[];
  cursor_example: { mcpServers: Record<string, { url: string; headers: Record<string, string> }> };
};

type KbMcpIntegrationPanelProps = {
  mcpInfo: McpIntegrationInfo | null;
  onCopy: (text: string) => void | Promise<void>;
};

export function KbMcpIntegrationPanel({ mcpInfo, onCopy }: KbMcpIntegrationPanelProps) {
  const { t } = useI18n();
  const cursorJson = mcpInfo ? JSON.stringify(mcpInfo.cursor_example, null, 2) : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <PublicIcon name="plug-01" size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t.menu.kbMcp.connectionTitle}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3">
        {!mcpInfo ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <PublicIcon name="loader-01" size={14} className="animate-spin" />
            {t.common.loading}
          </p>
        ) : (
          <>
            <p className="text-[11px] leading-snug text-muted-foreground">{t.menu.kbMcp.hint}</p>
            <ol className="space-y-1.5 text-[11px] leading-snug text-muted-foreground">
              <li>1. {t.menu.kbMcp.stepCreateToken}</li>
              <li>2. {t.menu.kbMcp.stepCopyUrl}</li>
              <li>3. {t.menu.kbMcp.stepPasteConfig}</li>
            </ol>
            <label className="block space-y-1">
              <span className="text-[11px] text-muted-foreground">{t.menu.kbMcp.url}</span>
              <Input readOnly value={mcpInfo.mcp_url} className="h-8 font-mono text-xs" aria-label={t.menu.kbMcp.url} />
              <span className="block text-[11px] leading-snug text-muted-foreground">{t.menu.kbMcp.apiBaseNote}</span>
            </label>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">{t.menu.kbMcp.tools}</p>
              <div className="flex flex-wrap gap-1.5">
                {mcpInfo.tools.map((tool) => (
                  <Badge key={tool} variant="secondary" className="font-mono text-[11px] font-normal">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">{t.menu.kbMcp.cursorConfig}</p>
              <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                {cursorJson}
              </pre>
            </div>
          </>
        )}
      </div>
      <div className="flex h-12 shrink-0 items-center gap-2 border-t border-border px-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!mcpInfo}
          onClick={() => mcpInfo && void onCopy(mcpInfo.mcp_url)}
        >
          <PublicIcon name="copy-left" size={14} />
          {t.menu.kbMcp.copy}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-8"
          disabled={!mcpInfo}
          onClick={() => void onCopy(cursorJson)}
        >
          <PublicIcon name="file-code" size={14} />
          {t.menu.kbMcp.copyConfig}
        </Button>
      </div>
    </div>
  );
}
