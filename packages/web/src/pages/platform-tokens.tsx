import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmAlertDialog } from '@/components/console-ui/ConfirmAlertDialog.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import type { ApiTokenRow } from '@/components/kb-mcp-integration-panel.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { api } from '@/lib/api.js';

type CreateTokenResponse = {
  token: ApiTokenRow;
  secret: string;
};

export function PlatformTokensPage() {
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const { kbs, loading: kbsLoading } = useKbCatalog();
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [selectedKbIds, setSelectedKbIds] = useState<Set<string>>(new Set());
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const body = await api<{ tokens: ApiTokenRow[] }>('/api/tokens');
      setTokens(body.tokens);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.operationFailed);
    } finally {
      setLoading(false);
    }
  }, [t.common.operationFailed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (kbs.length && selectedKbIds.size === 0) {
      setSelectedKbIds(new Set(kbs.map((kb) => kb.id)));
    }
  }, [kbs, selectedKbIds.size]);

  function toggleKb(kbId: string, checked: boolean) {
    setSelectedKbIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(kbId);
      else next.delete(kbId);
      return next;
    });
  }

  async function createToken(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || selectedKbIds.size === 0) return;
    try {
      const body = await api<CreateTokenResponse>('/api/tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          scope,
          kb_ids: [...selectedKbIds],
        }),
      });
      setCreatedSecret(body.secret);
      setName('');
      await reload();
      toast.success(t.common.updateSuccess);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.operationFailed);
    }
  }

  async function revokeToken(tokenId: string) {
    try {
      await api(`/api/tokens/${tokenId}`, { method: 'DELETE' });
      await reload();
      toast.success(t.common.deleteSuccess);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.deleteFailed);
    }
  }

  async function copySecret(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.common.copySuccess);
    } catch {
      toast.error(t.menu.kbMcp.copyFailed);
    }
  }

  const active = tokens.filter((row) => !row.revoked_at);
  const kbNameById = new Map(kbs.map((kb) => [kb.id, kb.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: t.menu.platformTokens.title },
        ]}
      />
      <p className="text-sm text-muted-foreground">{t.menu.platformTokens.subtitle}</p>

      {createdSecret ? (
        <Card className="border-primary/40 bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.menu.platformTokens.secretTitle}</CardTitle>
            <CardDescription>{t.menu.platformTokens.secretHint}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <code className="break-all text-xs">{createdSecret}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => void copySecret(createdSecret)}>
              {t.menu.kbMcp.copyToken}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.menu.platformTokens.createTitle}</CardTitle>
          <CardDescription>{t.menu.kbMcp.bearerHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={createToken}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pt-name">{t.menu.kbMcp.nameLabel}</Label>
                <Input
                  id="pt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={64}
                  placeholder={t.menu.kbMcp.namePlaceholder}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.menu.kbMcp.scopeLabel}</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as 'read' | 'write')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">{zh ? '只读' : 'Read'}</SelectItem>
                    <SelectItem value="write">{zh ? '读写' : 'Write'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.menu.platformTokens.kbScope}</Label>
              {kbsLoading ? (
                <p className="text-sm text-muted-foreground">{t.common.loading}</p>
              ) : kbs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {zh ? '暂无知识库。' : 'No knowledge bases.'}{' '}
                  <Link className="text-primary underline" to="/kbs">{t.menu.platform.kbs}</Link>
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {kbs.map((kb) => (
                    <li key={kb.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`kb-${kb.id}`}
                        checked={selectedKbIds.has(kb.id)}
                        onCheckedChange={(checked) => toggleKb(kb.id, checked === true)}
                      />
                      <Label htmlFor={`kb-${kb.id}`} className="font-normal">
                        {kb.name}
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button type="submit" disabled={!name.trim() || selectedKbIds.size === 0}>
              {t.menu.kbMcp.createButton}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.menu.platformTokens.listTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.menu.kbMcp.emptyTokens}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.menu.kbMcp.nameLabel}</TableHead>
                  <TableHead>{t.menu.kbMcp.scopeLabel}</TableHead>
                  <TableHead>{t.menu.platformTokens.kbScope}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.menu.kbMcp.lastUsed}</TableHead>
                  <TableHead className="text-right">{t.menu.kbMcp.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.scope}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.kb_ids.map((id) => (
                          <Badge key={id} variant="secondary" className="text-[10px]">
                            {kbNameById.get(id) ?? id.slice(0, 8)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {row.last_used_at ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {row.secret ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void copySecret(row.secret!)}
                          >
                            {t.menu.kbMcp.copyToken}
                          </Button>
                        ) : null}
                        <ConfirmAlertDialog
                          title={t.menu.kbMcp.deleteTitle}
                          description={t.menu.kbMcp.deleteConfirm}
                          confirmLabel={t.menu.kbMcp.delete}
                          destructive
                          onConfirm={() => revokeToken(row.id)}
                          trigger={
                            <Button type="button" variant="ghost" size="sm">
                              {t.menu.kbMcp.revoke}
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t.menu.platformTokens.mcpHint}{' '}
        <Link className="text-primary underline" to="/kbs">
          {zh ? '进入某知识库 → 对话' : 'Open a KB → Ask'}
        </Link>
        {zh ? ' 查看单库 MCP 配置。' : ' for per-KB MCP URL and tools.'}
      </p>
    </div>
  );
}
