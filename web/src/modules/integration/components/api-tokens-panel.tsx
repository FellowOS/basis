import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmAlertDialog } from '@/components/app/shared/console/ConfirmAlertDialog.js';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
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
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleDateTime, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { mcpTokenScopeLabel } from '@/modules/integration/lib/mcp-labels.js';

export type ApiTokenRow = {
  id: string;
  name: string;
  scope: string;
  workspace_ids: string[];
  allowed_operations?: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  secret?: string;
};

type ApiTokensPanelProps = {
  apiTokens: ApiTokenRow[];
  canManageTokens: boolean;
  availableToolNames?: string[];
  onCreateToken: (
    name: string,
    scope: 'read' | 'write',
    allowedOperations?: string[] | null,
  ) => void | Promise<void>;
  createdSecret: string | null;
  onDismissCreatedSecret: () => void;
  onCopy: (text: string) => void | Promise<void>;
  onDeleteToken: (tokenId: string) => void | Promise<void>;
};

export function ApiTokensPanel({
  apiTokens,
  canManageTokens,
  availableToolNames = [],
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
  const [restrictOps, setRestrictOps] = useState(false);
  const [selectedOps, setSelectedOps] = useState<Record<string, boolean>>({});
  const activeTokens = apiTokens.filter((row) => !row.revoked_at);

  const sortedToolNames = useMemo(
    () => [...availableToolNames].sort((a, b) => a.localeCompare(b)),
    [availableToolNames],
  );

  const createTokenSchema = z.object({
    name: z.string().trim().min(1).max(64),
    scope: z.enum(['read', 'write']),
  });

  const createTokenForm = useForm<z.infer<typeof createTokenSchema>>({
    resolver: zodResolver(createTokenSchema),
    defaultValues: { name: '', scope: 'read' },
  });

  useEffect(() => {
    if (!createOpen) {
      createTokenForm.reset({ name: '', scope: 'read' });
      setRestrictOps(false);
      setSelectedOps({});
    }
  }, [createOpen, createTokenForm]);

  async function submitCreateToken(values: z.infer<typeof createTokenSchema>) {
    const allowed = restrictOps
      ? sortedToolNames.filter((name) => selectedOps[name])
      : null;
    if (restrictOps && (!allowed || allowed.length === 0)) {
      createTokenForm.setError('name', { message: tokensCopy.operations_label });
      return;
    }
    try {
      await onCreateToken(values.name, values.scope, allowed);
      setCreateOpen(false);
    } catch {
      /* toast handled in hook */
    }
  }

  function toggleOp(name: string, checked: boolean) {
    setSelectedOps((prev) => ({ ...prev, [name]: checked }));
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
                {' · '}
                {row.allowed_operations?.length
                  ? fmt(tokensCopy.restricted_badge, { count: row.allowed_operations.length })
                  : tokensCopy.unrestricted_badge}
              </p>
            </div>
          ))
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden sm:max-w-lg">
          <Form {...createTokenForm}>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={createTokenForm.handleSubmit(submitCreateToken)}
            >
              <DialogHeader>
                <DialogTitle>{mcp.create_button}</DialogTitle>
                <DialogDescription>{mcp.bearer_hint}</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
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
                <FormField
                  control={createTokenForm.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{mcp.scope_label}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="api-token-scope-select">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="read">{tokensCopy.scope_read}</SelectItem>
                          <SelectItem value="write">{tokensCopy.scope_write}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="api-token-restrict-ops" className="text-sm">
                      {tokensCopy.restrict_operations}
                    </Label>
                    <Switch
                      id="api-token-restrict-ops"
                      checked={restrictOps}
                      onCheckedChange={setRestrictOps}
                      data-testid="api-token-restrict-ops"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{tokensCopy.restrict_operations_hint}</p>
                  {restrictOps ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next: Record<string, boolean> = {};
                            for (const name of sortedToolNames) {
                              next[name] = true;
                            }
                            setSelectedOps(next);
                          }}
                        >
                          {tokensCopy.operations_select_all}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOps({})}
                        >
                          {tokensCopy.operations_clear}
                        </Button>
                      </div>
                      <p className="text-xs font-medium text-foreground">{tokensCopy.operations_label}</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                        {sortedToolNames.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{mcp.tools}</p>
                        ) : (
                          sortedToolNames.map((toolName) => (
                            <label
                              key={toolName}
                              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selectedOps[toolName] ?? false}
                                onCheckedChange={(v) => toggleOp(toolName, v === true)}
                              />
                              <span className="font-mono text-[11px]">{toolName}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
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
