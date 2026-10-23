import { Link } from 'react-router-dom';
import { ConfirmAlertDialog } from '@/components/app/shared/console/ConfirmAlertDialog.js';
import { Button } from '@/components/ui/button.js';
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
  mcp_allowed_operations?: string[];
  http_allowed_operations?: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  secret?: string;
};

type ApiTokensPanelProps = {
  apiTokens: ApiTokenRow[];
  canManageTokens: boolean;
  createTokenPath: string;
  createdSecret: string | null;
  onDismissCreatedSecret: () => void;
  onCopy: (text: string) => void | Promise<void>;
  onDeleteToken: (tokenId: string) => void | Promise<void>;
};

export function ApiTokensPanel({
  apiTokens,
  canManageTokens,
  createTokenPath,
  createdSecret,
  onDismissCreatedSecret,
  onCopy,
  onDeleteToken,
}: ApiTokensPanelProps) {
  const { t, locale } = useI18n();
  const mcp = t.integration.mcp;
  const tokensCopy = t.integration.tokens;
  const activeTokens = apiTokens.filter((row) => !row.revoked_at);

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
          <Button size="sm" className="ml-auto h-8" asChild>
            <Link to={createTokenPath} data-testid="api-token-create-link">
              <PublicIcon name="plus-01" size={14} className="mr-1" />
              {mcp.create_button}
            </Link>
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
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <PublicIcon name="key-01" size={18} className="text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{mcp.empty_tokens}</p>
            {canManageTokens ? (
              <>
                <p className="max-w-xs text-[11px] leading-snug text-muted-foreground">{mcp.empty_tokens_hint}</p>
                <Button size="sm" asChild>
                  <Link to={createTokenPath}>{mcp.create_button}</Link>
                </Button>
              </>
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
                {row.mcp_allowed_operations?.length || row.http_allowed_operations?.length
                  ? fmt(tokensCopy.restricted_grants_badge, {
                      mcp: row.mcp_allowed_operations?.length ?? 0,
                      http: row.http_allowed_operations?.length ?? 0,
                    })
                  : tokensCopy.unrestricted_badge}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
