import type { KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';
import { kbOntologyProposalPath, kbPath } from '@/lib/nav-config.js';
import { kbReviewDecisionPath, kbReviewItemPath } from '@/lib/reviewUrlState.js';
import { kbIngestSourcePath } from '@/lib/sourcesUrlState.js';

export type KbAlertActionLabelKey =
  | 'viewProposal'
  | 'viewSources'
  | 'viewReview'
  | 'viewChat'
  | 'viewDecisions';

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

  if (alert.kind === 'governance.tripped') {
    const decisionId = detail.decision_id;
    if (typeof decisionId === 'string' && decisionId.length > 0) {
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

  if (alert.kind === 'sync_failed') {
    const sourceId = detail.source_id;
    if (typeof sourceId === 'string' && sourceId.length > 0) {
      return { href: kbIngestSourcePath(kbId, sourceId), labelKey: 'viewSources' };
    }
    return { href: kbPath(kbId, 'sources'), labelKey: 'viewSources' };
  }

  if (alert.kind.startsWith('llm.')) {
    return { href: kbPath(kbId, 'chat'), labelKey: 'viewChat' };
  }

  return null;
}
