import { describe, expect, it } from 'vitest';
import { kbAlertAction } from '@/lib/kb-alert-actions.js';
import type { KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';

function alert(partial: Partial<KbAlertStreamItem> & Pick<KbAlertStreamItem, 'kind'>): KbAlertStreamItem {
  return {
    id: 'a1',
    severity: 'warning',
    message: 'test',
    detail: {},
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('kbAlertAction', () => {
  it('links ontology proposals', () => {
    const action = kbAlertAction(
      'kb-1',
      alert({
        kind: 'governance.proposal_proposed',
        detail: { proposal_id: 'prop-9' },
      }),
    );
    expect(action?.href).toContain('/kbs/kb-1/ontology-versions');
    expect(action?.href).toContain('ontologyProposal=prop-9');
    expect(action?.labelKey).toBe('viewProposal');
  });

  it('links governance tripped with proposal to ontology', () => {
    const action = kbAlertAction(
      'kb-1',
      alert({ kind: 'governance.tripped', detail: { proposal_id: 'p2' } }),
    );
    expect(action?.labelKey).toBe('viewProposal');
  });

  it('links governance tripped with decision id to decisions tab', () => {
    const action = kbAlertAction(
      'kb-1',
      alert({ kind: 'governance.tripped', detail: { decision_id: 'dec-9' } }),
    );
    expect(action?.href).toBe('/kbs/kb-1/decisions?decision=dec-9');
    expect(action?.labelKey).toBe('viewDecisions');
  });

  it('links statement conflict alerts to review item', () => {
    const action = kbAlertAction(
      'kb-1',
      alert({ kind: 'governance.statement_conflict', detail: { item_id: 'conf-1' } }),
    );
    expect(action?.href).toBe('/kbs/kb-1/review?reviewItem=conf-1');
    expect(action?.labelKey).toBe('viewReview');
  });

  it('links governance tripped with review item to queue deep link', () => {
    const action = kbAlertAction(
      'kb-1',
      alert({ kind: 'governance.tripped', detail: { item_id: 'item-3' } }),
    );
    expect(action?.href).toBe('/kbs/kb-1/review?reviewItem=item-3');
    expect(action?.labelKey).toBe('viewReview');
  });

  it('links processing.failed to job history deep link', () => {
    const action = kbAlertAction(
      'kb-1',
      alert({ kind: 'processing.failed', detail: { job_id: 'job-42' } }),
    );
    expect(action?.href).toBe('/kbs/kb-1/sources?job=job-42');
    expect(action?.labelKey).toBe('viewProcessingJob');
  });

  it('links sync_failed to sources connector focus', () => {
    const action = kbAlertAction('kb-1', alert({ kind: 'sync_failed', detail: { source_id: 's1' } }));
    expect(action?.href).toBe('/kbs/kb-1/sources?connectors=1&ingestSource=s1');
  });

  it('links llm alerts to chat', () => {
    const action = kbAlertAction('kb-1', alert({ kind: 'llm.tool_loop_limit' }));
    expect(action?.href).toBe('/kbs/kb-1/chat');
    expect(action?.labelKey).toBe('viewChat');
  });
});
