import type { WorkspaceAlertStreamItem } from '@/modules/alerts/lib/alerts-stream.js';
import { workspaceOntologyProposalPath, workspacePath } from '@/lib/nav/nav-config.js';
import { decisionIdFromDetail, reviewDecisionPath, reviewItemPath } from '@/modules/review/lib/review-url-state.js';
import { processingJobPath } from '@/modules/processing/lib/processing-url-state.js';

export type AlertActionLabelKey =
  | 'viewProposal'
  | 'viewSources'
  | 'viewReview'
  | 'viewSettings'
  | 'viewDecisions'
  | 'viewProcessingJob';

export type AlertAction = {
  href: string;
  labelKey: AlertActionLabelKey;
};

function proposalIdFromDetail(detail: Record<string, unknown>): string | null {
  const id = detail.proposal_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Deep link from an alert episode to the relevant workspace (F-ALT). */
export function workspaceAlertAction(workspaceId: string, alert: WorkspaceAlertStreamItem): AlertAction | null {
  const detail = alert.detail ?? {};
  const proposalId = proposalIdFromDetail(detail);

  if (alert.kind === 'governance.proposal_proposed' && proposalId) {
    return { href: workspaceOntologyProposalPath(workspaceId, proposalId), labelKey: 'viewProposal' };
  }

  if (alert.kind === 'governance.statement_conflict') {
    const itemId =
      (typeof detail.item_id === 'string' && detail.item_id) ||
      (typeof detail.review_item_id === 'string' && detail.review_item_id) ||
      '';
    if (itemId.length > 0) {
      return { href: reviewItemPath(workspaceId, itemId), labelKey: 'viewReview' };
    }
    return { href: workspacePath(workspaceId, 'review'), labelKey: 'viewReview' };
  }

  if (alert.kind === 'governance.tripped') {
    const decisionId = decisionIdFromDetail(detail);
    if (decisionId) {
      return { href: reviewDecisionPath(workspaceId, decisionId), labelKey: 'viewDecisions' };
    }
    if (proposalId) {
      return { href: workspaceOntologyProposalPath(workspaceId, proposalId), labelKey: 'viewProposal' };
    }
    const itemId = detail.item_id;
    if (typeof itemId === 'string' && itemId.length > 0) {
      return { href: reviewItemPath(workspaceId, itemId), labelKey: 'viewReview' };
    }
    return { href: workspacePath(workspaceId, 'review'), labelKey: 'viewReview' };
  }

  if (alert.kind === 'processing.failed') {
    const jobId = detail.job_id;
    if (typeof jobId === 'string' && jobId.length > 0) {
      return { href: processingJobPath(workspaceId, jobId), labelKey: 'viewProcessingJob' };
    }
    return { href: workspacePath(workspaceId, 'sources'), labelKey: 'viewSources' };
  }

  if (alert.kind === 'sync_failed') {
    return { href: workspacePath(workspaceId, 'sources'), labelKey: 'viewSources' };
  }

  if (alert.kind.startsWith('llm.')) {
    return { href: workspacePath(workspaceId, 'settings'), labelKey: 'viewSettings' };
  }

  return null;
}
