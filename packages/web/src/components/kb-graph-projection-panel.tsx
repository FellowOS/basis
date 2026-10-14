import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSemaSession } from '@/lib/sema-session.js';
import { KbGraphAuditRecent } from '@/components/kb-graph-audit-recent.js';
import { KbGraphRebuildButton } from '@/components/kb-graph-rebuild-button.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { kbPath } from '@/lib/nav-config.js';

type GraphProjectionStatus = {
  revision: number;
  schema_version: number;
  status: string;
  last_built_at: string | null;
  last_error_code: string | null;
  node_count?: number;
  edge_count?: number;
};

export function KbGraphProjectionPanel({
  kbId,
  canRebuild,
  graphEnabled,
}: {
  kbId: string;
  canRebuild: boolean;
  graphEnabled: boolean;
}) {
  const { locale } = useI18n();
  const { isAdmin } = useSemaSession();
  const zh = locale === 'zh';
  const auditGraphUrl = `/audit?kb_id=${encodeURIComponent(kbId)}&action_prefix=${encodeURIComponent('kb.graph.')}`;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GraphProjectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!graphEnabled) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await api<GraphProjectionStatus>(`/api/kbs/${kbId}/graph/projection`);
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : zh ? '加载失败' : 'Load failed');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [graphEnabled, kbId, zh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!graphEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{zh ? 'Explorer 图谱投影' : 'Explorer graph projection'}</CardTitle>
          <CardDescription>
            {zh ? '当前环境未启用 Explorer 运行时。' : 'Explorer runtime is not available in this environment.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{zh ? 'Explorer 图谱投影' : 'Explorer graph projection'}</CardTitle>
          <CardDescription>
            {zh
              ? '画布数据来自账本投影。重建会用账本覆盖当前 Explorer 会话并写入审计。'
              : 'The canvas reads from the ledger-backed projection. Rebuild replaces the Explorer session from ledger and is audited.'}
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={kbPath(kbId, 'graph')}>{zh ? '打开图谱' : 'Open graph'}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {zh ? '加载中…' : 'Loading…'}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : status ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{zh ? '账本修订' : 'Ledger revision'}</dt>
              <dd className="font-mono font-medium">{status.revision}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{zh ? '投影状态' : 'Projection status'}</dt>
              <dd className="font-medium">{status.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{zh ? '节点 / 边' : 'Nodes / edges'}</dt>
              <dd className="font-mono">
                {status.node_count ?? '—'} / {status.edge_count ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{zh ? '上次构建' : 'Last built'}</dt>
              <dd>{status.last_built_at ?? '—'}</dd>
            </div>
            {status.last_error_code ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{zh ? '最近错误' : 'Last error'}</dt>
                <dd className="font-mono text-destructive">{status.last_error_code}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canRebuild ? (
            <KbGraphRebuildButton
              kbId={kbId}
              onRebuilt={() => {
                void refresh();
                setAuditRefreshKey((key) => key + 1);
              }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {zh ? '需要编辑者角色才能重建投影。' : 'Editor role required to rebuild projection.'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {zh
              ? '操作记入平台审计（kb.graph.projection_rebuild）。'
              : 'Recorded in platform audit as kb.graph.projection_rebuild.'}
            {isAdmin ? (
              <>
                {' '}
                <Link className="text-primary hover:underline" to={auditGraphUrl}>
                  {zh ? '在审计日志中查看图谱事件' : 'View graph events in audit'}
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <KbGraphAuditRecent kbId={kbId} refreshKey={auditRefreshKey} />
      </CardContent>
    </Card>
  );
}
