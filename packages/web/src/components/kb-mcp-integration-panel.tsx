import type { FormEvent, ReactNode } from 'react';
import { ConfirmAlertDialog } from '@/components/console-ui/ConfirmAlertDialog.js';
import { EmptyState } from '@/components/console-ui/EmptyState.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Separator } from '@/components/ui/separator.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { useI18n } from '@/i18n/context.js';

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
  tokenName: string;
  onTokenNameChange: (value: string) => void;
  onCreateToken: (event: FormEvent) => void;
  onCopy: (text: string) => void | Promise<void>;
  onDeleteToken: (tokenId: string) => void | Promise<void>;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-foreground">{children}</p>;
}

export function KbMcpIntegrationPanel({
  mcpInfo,
  apiTokens,
  canManageTokens,
  tokenName,
  onTokenNameChange,
  onCreateToken,
  onCopy,
  onDeleteToken,
}: KbMcpIntegrationPanelProps) {
  const { t } = useI18n();
  const cursorJson = mcpInfo ? JSON.stringify(mcpInfo.cursor_example, null, 2) : '';
  const activeTokens = apiTokens.filter((row) => !row.revoked_at);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardHeader className="border-b border-border/60 pb-6">
          <CardTitle className="text-base">{t.menu.kbMcp.connectionTitle}</CardTitle>
          <CardDescription>{t.menu.kbMcp.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {!mcpInfo ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : (
            <>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    1
                  </span>
                  <span>{t.menu.kbMcp.stepCreateToken}</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    2
                  </span>
                  <span>{t.menu.kbMcp.stepCopyUrl}</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    3
                  </span>
                  <span>{t.menu.kbMcp.stepPasteConfig}</span>
                </li>
              </ol>

              <Separator />

              <div className="space-y-2">
                <SectionLabel>{t.menu.kbMcp.url}</SectionLabel>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    readOnly
                    value={mcpInfo.mcp_url}
                    className="font-mono text-xs sm:flex-1"
                    aria-label={t.menu.kbMcp.url}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => void onCopy(mcpInfo.mcp_url)}
                  >
                    {t.menu.kbMcp.copy}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t.menu.kbMcp.apiBaseNote}</p>
              </div>

              <div className="space-y-2">
                <SectionLabel>{t.menu.kbMcp.tools}</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {mcpInfo.tools.map((tool) => (
                    <Badge key={tool} variant="secondary" className="font-mono text-xs font-normal">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel>{t.menu.kbMcp.cursorConfig}</SectionLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onCopy(cursorJson)}
                  >
                    {t.menu.kbMcp.copyConfig}
                  </Button>
                </div>
                <pre
                  className="max-h-64 overflow-auto rounded-lg border border-border/80 bg-muted/40 p-4 font-mono text-[11px] leading-relaxed text-foreground/90"
                >
                  {cursorJson}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-5">
        <CardHeader className="border-b border-border/60 pb-6">
          <CardTitle className="text-base">{t.menu.kbMcp.tokensTitle}</CardTitle>
          <CardDescription>{t.menu.kbMcp.bearerHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {!canManageTokens ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {t.menu.kbMcp.adminOnly}
            </p>
          ) : (
            <form
              onSubmit={onCreateToken}
              className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-4 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="kb-token-name">{t.menu.kbMcp.nameLabel}</Label>
                <Input
                  id="kb-token-name"
                  value={tokenName}
                  onChange={(e) => onTokenNameChange(e.target.value)}
                  maxLength={64}
                  placeholder={t.menu.kbMcp.namePlaceholder}
                  required
                />
              </div>
              <Button type="submit" className="shrink-0" disabled={!tokenName.trim()}>
                {t.menu.kbMcp.createButton}
              </Button>
            </form>
          )}

          {activeTokens.length === 0 ? (
            <EmptyState
              title={t.menu.kbMcp.emptyTokens}
              description={canManageTokens ? t.menu.kbMcp.emptyTokensHint : undefined}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/80">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>{t.menu.kbMcp.nameLabel}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t.menu.kbMcp.lastUsed}</TableHead>
                    <TableHead className="text-right">{t.menu.kbMcp.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTokens.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{row.scope}</div>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                        {row.last_used_at ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!row.secret}
                            title={row.secret ? undefined : t.menu.kbMcp.copyTokenUnavailable}
                            onClick={() => row.secret && void onCopy(row.secret)}
                          >
                            {t.menu.kbMcp.copyToken}
                          </Button>
                          {canManageTokens && (
                            <ConfirmAlertDialog
                              title={t.menu.kbMcp.deleteTitle}
                              description={t.menu.kbMcp.deleteConfirm}
                              destructive
                              onConfirm={() => onDeleteToken(row.id)}
                              trigger={
                                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                                  {t.menu.kbMcp.delete}
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
