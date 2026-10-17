import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmAlertDialog } from '@/components/app/shared/console/ConfirmAlertDialog.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleDateTime, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { kbMcpTokenScopeLabel } from '@/lib/kb-mcp-labels.js';

export type McpIntegrationInfo = {
  mcp_url: string;
  tools: string[];
  cursor_example: { mcpServers: Record<string, { url: string; headers: Record<string, string> }> };
};

export type ApiTokenRow = {
  id: string;
  name: string;
  scope: string;
  kb_ids: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  secret?: string;
};

type KbMcpIntegrationPanelProps = {
  mcpInfo: McpIntegrationInfo | null;
  apiTokens: ApiTokenRow[];
  canManageTokens: boolean;
  onCreateToken: (name: string) => void | Promise<void>;
  createdSecret: string | null;
  onDismissCreatedSecret: () => void;
  onCopy: (text: string) => void | Promise<void>;
  onDeleteToken: (tokenId: string) => void | Promise<void>;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  showCreateInCard?: boolean;
};

export function KbMcpIntegrationPanel({
  mcpInfo,
  apiTokens,
  canManageTokens,
  onCreateToken,
  createdSecret,
  onDismissCreatedSecret,
  onCopy,
  onDeleteToken,
  createOpen: createOpenProp,
  onCreateOpenChange,
  showCreateInCard = true,
}: KbMcpIntegrationPanelProps) {
  const { t, locale } = useI18n();
  const mcp = t.menu.kbMcp;
  const [createOpenInternal, setCreateOpenInternal] = useState(false);
  const createOpen = createOpenProp ?? createOpenInternal;
  const setCreateOpen = onCreateOpenChange ?? setCreateOpenInternal;
  const cursorJson = mcpInfo ? JSON.stringify(mcpInfo.cursor_example, null, 2) : '';
  const activeTokens = apiTokens.filter((row) => !row.revoked_at);

  const createTokenSchema = z.object({
    name: z.string().trim().min(1).max(64),
  });

  const createTokenForm = useForm<z.infer<typeof createTokenSchema>>({
    resolver: zodResolver(createTokenSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (!createOpen) createTokenForm.reset({ name: '' });
  }, [createOpen, createTokenForm]);

  async function submitCreateToken(values: z.infer<typeof createTokenSchema>) {
    try {
      await onCreateToken(values.name);
      setCreateOpen(false);
    } catch {
      /* toast handled in hook */
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden max-[900px]:flex-col">
      <div className="flex w-[min(480px,42vw)] min-w-[280px] max-w-[520px] shrink-0 flex-col overflow-hidden border-r border-border max-[900px]:max-h-[min(52vh,480px)] max-[900px]:w-full max-[900px]:max-w-none max-[900px]:border-r-0 max-[900px]:border-b">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <PublicIcon name="key-01" size={13} className="shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t.menu.kbMcp.tokensTitle}
          </span>
          {activeTokens.length > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatLocaleNumber(locale as Locale, activeTokens.length)}
            </span>
          ) : null}
          {canManageTokens && showCreateInCard ? (
            <Button type="button" size="sm" className="ml-auto h-8" onClick={() => setCreateOpen(true)}>
              {t.menu.kbMcp.createButton}
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {createdSecret ? (
            <div className="space-y-2 border-b border-border px-4 py-3">
              <p className="text-[13px] text-foreground">{t.menu.kbMcp.secretOnce}</p>
              <code className="block break-all font-mono text-[11px] text-foreground">{createdSecret}</code>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void onCopy(createdSecret)}>
                  {t.menu.kbMcp.copyToken}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={onDismissCreatedSecret}>
                  {t.menu.kbMcp.secretDismiss}
                </Button>
              </div>
            </div>
          ) : null}
          {!canManageTokens ? (
            <p className="border-b border-border px-4 py-3 text-[11px] text-muted-foreground">{t.menu.kbMcp.adminOnly}</p>
          ) : null}
          {activeTokens.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <PublicIcon name="key-01" size={18} className="mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{t.menu.kbMcp.emptyTokens}</p>
              {canManageTokens ? (
                <p className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">{t.menu.kbMcp.emptyTokensHint}</p>
              ) : null}
            </div>
          ) : (
            activeTokens.map((row) => (
              <div key={row.id} className="border-b border-border px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[13px] text-foreground">{row.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-[11px]"
                      disabled={!row.secret}
                      title={row.secret ? undefined : t.menu.kbMcp.copyTokenUnavailable}
                      onClick={() => row.secret && void onCopy(row.secret)}
                    >
                      {t.menu.kbMcp.copyToken}
                    </Button>
                    {canManageTokens ? (
                      <ConfirmAlertDialog
                        title={t.menu.kbMcp.deleteTitle}
                        description={t.menu.kbMcp.deleteConfirm}
                        destructive
                        onConfirm={() => onDeleteToken(row.id)}
                        trigger={
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-[11px] text-destructive"
                          >
                            {t.menu.kbMcp.delete}
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {fmt(mcp.tokenMeta, {
                    scope: kbMcpTokenScopeLabel(mcp, row.scope),
                    lastUsed: row.last_used_at
                      ? formatLocaleDateTime(locale as Locale, row.last_used_at)
                      : mcp.lastUsedNever,
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <Form {...createTokenForm}>
            <form onSubmit={createTokenForm.handleSubmit(submitCreateToken)}>
              <DialogHeader>
                <DialogTitle>{t.menu.kbMcp.createButton}</DialogTitle>
                <DialogDescription>{t.menu.kbMcp.bearerHint}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <FormField
                  control={createTokenForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.menu.kbMcp.nameLabel}</FormLabel>
                      <FormControl>
                        <Input maxLength={64} placeholder={t.menu.kbMcp.namePlaceholder} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createTokenForm.formState.isSubmitting}>
                  {t.menu.kbMcp.createButton}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
