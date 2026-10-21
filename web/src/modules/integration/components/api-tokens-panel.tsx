import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmAlertDialog } from '@/components/app/shared/console/ConfirmAlertDialog.js';
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
import { mcpTokenScopeLabel } from '@/lib/workspace/mcp-labels.js';

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

type ApiTokensPanelProps = {
  apiTokens: ApiTokenRow[];
  canManageTokens: boolean;
  onCreateToken: (name: string) => void | Promise<void>;
  createdSecret: string | null;
  onDismissCreatedSecret: () => void;
  onCopy: (text: string) => void | Promise<void>;
  onDeleteToken: (tokenId: string) => void | Promise<void>;
};

export function ApiTokensPanel({
  apiTokens,
  canManageTokens,
  onCreateToken,
  createdSecret,
  onDismissCreatedSecret,
  onCopy,
  onDeleteToken,
}: ApiTokensPanelProps) {
  const { t, locale } = useI18n();
  const mcp = t.integration.mcp;
  const tokensCopy = t.integration.tokens;
  const [createOpen, setCreateOpen] = useState(false);
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <PublicIcon name="key-01" size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {mcp.tokens_title}
        </span>
        {activeTokens.length > 0 ? (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatLocaleNumber(locale as Locale, activeTokens.length)}
          </span>
        ) : null}
        {canManageTokens ? (
          <Button type="button" size="sm" className="ml-auto h-8" onClick={() => setCreateOpen(true)}>
            {mcp.create_button}
          </Button>
        ) : null}
      </div>
      <p className="shrink-0 border-b border-border px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">
        {tokensCopy.hint}
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        {createdSecret ? (
          <div className="space-y-2 border-b border-border px-4 py-3">
            <p className="text-[13px] text-foreground">{mcp.secret_once}</p>
            <code className="block break-all font-mono text-[11px] text-foreground">{createdSecret}</code>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void onCopy(createdSecret)}>
                {mcp.copy_token}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={onDismissCreatedSecret}>
                {mcp.secret_dismiss}
              </Button>
            </div>
          </div>
        ) : null}
        {!canManageTokens ? (
          <p className="border-b border-border px-4 py-3 text-[11px] text-muted-foreground">{mcp.admin_only}</p>
        ) : null}
        {activeTokens.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center px-6 py-10 text-center">
            <PublicIcon name="key-01" size={18} className="mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{mcp.empty_tokens}</p>
            {canManageTokens ? (
              <p className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">{mcp.empty_tokens_hint}</p>
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
                    title={row.secret ? undefined : mcp.copy_token_unavailable}
                    onClick={() => row.secret && void onCopy(row.secret)}
                  >
                    {mcp.copy_token}
                  </Button>
                  {canManageTokens ? (
                    <ConfirmAlertDialog
                      title={mcp.delete_title}
                      description={mcp.delete_confirm}
                      destructive
                      onConfirm={() => onDeleteToken(row.id)}
                      trigger={
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-[11px] text-destructive"
                        >
                          {mcp.delete}
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {fmt(mcp.token_meta, {
                  scope: mcpTokenScopeLabel(mcp, row.scope),
                  lastUsed: row.last_used_at
                    ? formatLocaleDateTime(locale as Locale, row.last_used_at)
                    : mcp.last_used_never,
                })}
              </p>
            </div>
          ))
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <Form {...createTokenForm}>
            <form onSubmit={createTokenForm.handleSubmit(submitCreateToken)}>
              <DialogHeader>
                <DialogTitle>{mcp.create_button}</DialogTitle>
                <DialogDescription>{mcp.bearer_hint}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <FormField
                  control={createTokenForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{mcp.name_label}</FormLabel>
                      <FormControl>
                        <Input maxLength={64} placeholder={mcp.name_placeholder} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {t.core.common.cancel}
                </Button>
                <Button type="submit" disabled={createTokenForm.formState.isSubmitting}>
                  {mcp.create_button}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
