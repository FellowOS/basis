import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatGraphAuditAction,
  formatGraphAuditDetail,
  proposalIdFromGraphAuditDetail,
  reviewItemIdFromGraphAuditDetail,
  type KbGraphAuditEvent,
} from '@/lib/kb-graph-audit.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';
import { kbOntologyProposalPath, kbPath } from '@/lib/nav-config.js';
import {
  decisionIdFromDetail,
  kbReviewDecisionPath,
  kbReviewItemPath,
} from '@/lib/reviewUrlState.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { formatLocaleDateTime } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';

export function KbGraphAuditRecent({
  kbId,
  limit = 15,
  actionPrefix = 'kb.graph.',
  refreshKey = 0,
}: {
  kbId: string;
  limit?: number;
  actionPrefix?: string;
  /** Bump after rebuild to refetch. */
  refreshKey?: number;
}) {
  const { t, locale } = useI18n();
  const w = t.kbGraphWorkspace.widgets;
  const linkClass =
    'inline-block text-[11px] text-foreground underline-offset-2 hover:underline';
  const [events, setEvents] = useState<KbGraphAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await kbOpenApiGET<{ events: KbGraphAuditEvent[] }>(
        kbId,
        'audit/graph-mutations',
        { params: { query: { limit, action_prefix: actionPrefix } } },
      );
      setEvents(body.events ?? []);
    } catch (err) {
      setError(formatUserFacingApiError(err, locale));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [actionPrefix, kbId, limit, locale]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">
        {w.auditTitle}
      </h3>
      <p className="text-xs text-muted-foreground">{w.auditDescription}</p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {t.common.loading}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{w.auditEmpty}</p>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {events.map((event) => {
              const detail = event.detail;
              const reviewItemId = reviewItemIdFromGraphAuditDetail(detail);
              const decisionId = decisionIdFromDetail(detail);
              const proposalId = proposalIdFromGraphAuditDetail(detail);
              return (
                <li
                  key={event.id}
                  className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {formatGraphAuditAction(event.action, locale)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatGraphAuditDetail(event, locale)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {reviewItemId ? (
                        <Link
                          to={kbReviewItemPath(kbId, reviewItemId)}
                          className={linkClass}
                          data-testid={`graph-audit-review-${reviewItemId}`}
                        >
                          {t.chat.openReviewItem}
                        </Link>
                      ) : null}
                      {decisionId ? (
                        <Link
                          to={kbReviewDecisionPath(kbId, decisionId)}
                          className={linkClass}
                          data-testid={`graph-audit-decision-${decisionId}`}
                        >
                          {t.kbReview.openDecision}
                        </Link>
                      ) : null}
                      {proposalId ? (
                        <Link
                          to={kbOntologyProposalPath(kbId, proposalId)}
                          className={linkClass}
                          data-testid={`graph-audit-proposal-${proposalId}`}
                        >
                          {t.kbReview.openOntologyProposal}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatLocaleDateTime(locale as Locale, event.created_at)}
                  </time>
                </li>
              );
            })}
          </ul>
          <Link
            to={kbPath(kbId, 'review')}
            className="inline-block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            data-testid="graph-audit-open-review"
          >
            {t.kbImportExport.openReviewQueue}
          </Link>
        </>
      )}
    </div>
  );
}
