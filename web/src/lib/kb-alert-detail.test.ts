import { describe, expect, it } from 'vitest';
import { messagesForLocale } from '@/i18n/pick-locale.js';
import { kbAlertDetailLines, groupAlertsByKind } from '@/lib/kb-alert-detail.js';
import type { KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';

function alert(partial: Partial<KbAlertStreamItem> & Pick<KbAlertStreamItem, 'kind'>): KbAlertStreamItem {
  return {
    id: 'a1',
    severity: 'warning',
    message: 'msg',
    detail: {},
    created_at: '2030-01-01T00:00:00Z',
    ...partial,
  };
}

describe('kbAlertDetailLines', () => {
  const alerts = messagesForLocale('en').pages.alerts;

  it('formats governance.tripped detail', () => {
    const lines = kbAlertDetailLines(
      alerts,
      alert({
        kind: 'governance.tripped',
        detail: { code: 'impact_gate_blocked', decision_id: 'dec-1', shacl_violation_count: 2 },
      }),
    );
    expect(lines.some((l) => l.includes('impact_gate_blocked'))).toBe(true);
    expect(lines.some((l) => l.includes('dec-1'))).toBe(true);
    expect(lines.some((l) => l.includes('2'))).toBe(true);
  });
});

describe('groupAlertsByKind', () => {
  it('preserves first-seen kind order', () => {
    const groups = groupAlertsByKind([
      alert({ id: '1', kind: 'processing.failed' }),
      alert({ id: '2', kind: 'governance.tripped' }),
      alert({ id: '3', kind: 'processing.failed' }),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['processing.failed', 'governance.tripped']);
    expect(groups[0]?.alerts).toHaveLength(2);
  });
});
