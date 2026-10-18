import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { clearKbGraphDiffPreviewParams } from '@/lib/graphUrlState.js';
import { kbGraphDiffPath } from '@/lib/nav-config.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';

type GraphDiffResponse = {
  from_time: string;
  to_time: string;
  summary: {
    nodes_added: number;
    nodes_removed: number;
    nodes_modified: number;
    edges_added: number;
    edges_removed: number;
  };
};

function changeTotal(summary: GraphDiffResponse['summary']): number {
  return (
    summary.nodes_added +
    summary.nodes_removed +
    summary.nodes_modified +
    summary.edges_added +
    summary.edges_removed
  );
}

/** Read-only diff overlay banner on the graph canvas (F-DIFF-01 staging preview). */
export function KbGraphDiffPreviewBar({
  kbId,
  diffFrom,
  diffTo,
}: {
  kbId: string;
  diffFrom: string;
  diffTo: string;
}) {
  const { t, locale } = useI18n();
  const g = t.kbGraphPage;
  const [, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<GraphDiffResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void kbOpenApiGET<GraphDiffResponse>(kbId, 'graph/diff', {
      params: { query: { from: diffFrom.trim(), to: diffTo.trim() } },
    })
      .then((data) => {
        if (!cancelled) setDiff(data);
      })
      .catch((err) => {
        if (!cancelled) setError(formatUserFacingApiError(err, locale as Locale));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [diffFrom, diffTo, kbId, locale]);

  const total = useMemo(() => (diff ? changeTotal(diff.summary) : 0), [diff]);

  function dismiss() {
    setSearchParams((prev) => clearKbGraphDiffPreviewParams(prev.toString()), { replace: true });
  }

  return (
    <Alert
      className="mx-3 mt-2 shrink-0 border-primary/25 bg-primary/5"
      data-testid="kb-graph-diff-preview-bar"
    >
      <PublicIcon name="git-diff" size={16} className="text-primary" />
      <AlertTitle className="text-sm">{g.diffPreviewTitle}</AlertTitle>
      <AlertDescription className="space-y-2 text-xs text-muted-foreground">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-3.5" />
            {t.common.loading}
          </span>
        ) : error ? (
          <span className="text-destructive">{error}</span>
        ) : diff ? (
          <span data-testid="kb-graph-diff-preview-summary">
            {fmt(g.diffPreviewSummary, {
              total: formatLocaleNumber(locale as Locale, total),
              added: formatLocaleNumber(locale as Locale, diff.summary.nodes_added),
              removed: formatLocaleNumber(locale as Locale, diff.summary.nodes_removed),
            })}
          </span>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-0.5">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link
              to={kbGraphDiffPath(kbId, diffFrom.trim(), diffTo.trim())}
              data-testid="kb-graph-diff-preview-open-full"
            >
              {g.diffPreviewOpenFull}
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={dismiss}
            data-testid="kb-graph-diff-preview-dismiss"
          >
            {g.diffPreviewDismiss}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
