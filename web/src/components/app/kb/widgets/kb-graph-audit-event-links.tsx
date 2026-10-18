import { Link } from 'react-router-dom';
import {
  proposalIdFromGraphAuditDetail,
  reviewItemIdFromGraphAuditDetail,
} from '@/lib/kb-graph-audit.js';
import { useI18n } from '@/i18n/context.js';
import { kbOntologyProposalPath } from '@/lib/nav-config.js';
import {
  decisionIdFromDetail,
  kbReviewDecisionPath,
  kbReviewItemPath,
} from '@/lib/reviewUrlState.js';

const linkClass =
  'inline-block text-[11px] text-foreground underline-offset-2 hover:underline';

export function KbGraphAuditEventLinks({
  kbId,
  detail,
  testIdPrefix = 'graph-audit',
}: {
  kbId: string;
  detail?: Record<string, unknown>;
  testIdPrefix?: string;
}) {
  const { t } = useI18n();
  const reviewItemId = reviewItemIdFromGraphAuditDetail(detail);
  const decisionId = decisionIdFromDetail(detail);
  const proposalId = proposalIdFromGraphAuditDetail(detail);

  if (!reviewItemId && !decisionId && !proposalId) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
      {reviewItemId ? (
        <Link
          to={kbReviewItemPath(kbId, reviewItemId)}
          className={linkClass}
          data-testid={`${testIdPrefix}-review-${reviewItemId}`}
        >
          {t.kbReview.openReviewItem}
        </Link>
      ) : null}
      {decisionId ? (
        <Link
          to={kbReviewDecisionPath(kbId, decisionId)}
          className={linkClass}
          data-testid={`${testIdPrefix}-decision-${decisionId}`}
        >
          {t.kbReview.openDecision}
        </Link>
      ) : null}
      {proposalId ? (
        <Link
          to={kbOntologyProposalPath(kbId, proposalId)}
          className={linkClass}
          data-testid={`${testIdPrefix}-proposal-${proposalId}`}
        >
          {t.kbReview.openOntologyProposal}
        </Link>
      ) : null}
    </div>
  );
}
