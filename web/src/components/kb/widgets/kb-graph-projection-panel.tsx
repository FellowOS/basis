import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBasisSession } from '@/lib/basis-session.js';
import { KbGraphAuditRecent } from '@/components/kb/widgets/kb-graph-audit-recent.js';
import { KbGraphRebuildButton } from '@/components/kb/widgets/kb-graph-rebuild-button.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError, messageForApiErrorCode } from '@/lib/api-error-message.js';
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
  const { t, locale } = useI18n();
  const p = t.kbGraphProjection;
  const { isAdmin } = useBasisSession();
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
      setError(formatUserFacingApiError(err, locale as Locale));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [graphEnabled, kbId, locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!graphEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{p.title}</CardTitle>
          <CardDescription>{p.unavailableDesc}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{p.title}</CardTitle>
          <CardDescription>{p.description}</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={kbPath(kbId, 'graph')}>{p.openGraph}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t.common.loading}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : status ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{p.ledgerRevision}</dt>
              <dd className="font-mono font-medium">{status.revision}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{p.projectionStatus}</dt>
              <dd className="font-medium">{status.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{p.nodesEdges}</dt>
              <dd className="font-mono">
                {status.node_count ?? '—'} / {status.edge_count ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{p.lastBuilt}</dt>
              <dd>{status.last_built_at ?? '—'}</dd>
            </div>
            {status.last_error_code ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{p.lastError}</dt>
                <dd className="text-destructive">
                  {messageForApiErrorCode(status.last_error_code, locale as Locale) ??
                    status.last_error_code}
                </dd>
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
            <p className="text-xs text-muted-foreground">{p.editorRequired}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {p.auditNote}
            {isAdmin ? (
              <>
                {' '}
                <Link className="text-primary hover:underline" to={auditGraphUrl}>
                  {p.viewAuditGraph}
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
