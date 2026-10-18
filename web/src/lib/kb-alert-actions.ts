import type { KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';
import { kbOntologyProposalPath, kbPath } from '@/lib/nav-config.js';
import { decisionIdFromDetail, kbReviewDecisionPath, kbReviewItemPath } from '@/lib/reviewUrlState.js';
import { kbProcessingJobPath } from '@/lib/processingUrlState.js';
import { kbIngestSourcePath } from '@/lib/sourcesUrlState.js';

export type KbAlertActionLabelKey =
  | 'viewProposal'
  | 'viewSources'
  | 'viewReview'
  | 'viewSettings'
  | 'viewDecisions'
  | 'viewProcessingJob';

export type KbAlertAction = {
  href: string;
  labelKey: KbAlertActionLabelKey;
};

function proposalIdFromDetail(detail: Record<string, unknown>): string | null {
  const id = detail.proposal_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Deep link from an alert episode to the relevant KB workspace (F-ALT). */
export function kbAlertAction(kbId: string, alert: KbAlertStreamItem): KbAlertAction | null {
  const detail = alert.detail ?? {};
  const proposalId = proposalIdFromDetail(detail);

  if (alert.kind === 'governance.proposal_proposed' && proposalId) {
    return { href: kbOntologyProposalPath(kbId, proposalId), labelKey: 'viewProposal' };
  }

  if (alert.kind === 'governance.statement_conflict') {
    const itemId =
      (typeof detail.item_id === 'string' && detail.item_id) ||
      (typeof detail.review_item_id === 'string' && detail.review_item_id) ||
      '';
    if (itemId.length > 0) {
      return { href: kbReviewItemPath(kbId, itemId), labelKey: 'viewReview' };
    }
    return { href: kbPath(kbId, 'review'), labelKey: 'viewReview' };
  }

  if (alert.kind === 'governance.tripped') {
    const decisionId = decisionIdFromDetail(detail);
    if (decisionId) {
      return { href: kbReviewDecisionPath(kbId, decisionId), labelKey: 'viewDecisions' };
    }
    if (proposalId) {
      return { href: kbOntologyProposalPath(kbId, proposalId), labelKey: 'viewProposal' };
    }
    const itemId = detail.item_id;
    if (typeof itemId === 'string' && itemId.length > 0) {
      return { href: kbReviewItemPath(kbId, itemId), labelKey: 'viewReview' };
    }
    return { href: kbPath(kbId, 'review'), labelKey: 'viewReview' };
  }

  if (alert.kind === 'processing.failed') {
    const jobId = detail.job_id;
    if (typeof jobId === 'string' && jobId.length > 0) {
      return { href: kbProcessingJobPath(kbId, jobId), labelKey: 'viewProcessingJob' };
    }
    return { href: kbPath(kbId, 'sources'), labelKey: 'viewSources' };
  }

  if (alert.kind === 'sync_failed') {
    const sourceId = detail.source_id;
    if (typeof sourceId === 'string' && sourceId.length > 0) {
      return { href: kbIngestSourcePath(kbId, sourceId), labelKey: 'viewSources' };
    }
    return { href: kbPath(kbId, 'sources'), labelKey: 'viewSources' };
  }

  if (alert.kind.startsWith('llm.')) {
    return { href: kbPath(kbId, 'settings'), labelKey: 'viewSettings' };
  }

  return null;
}
