import { describe, expect, it } from 'vitest';
import { isGovernanceGateErrorCode, readApiErrorCode } from '@/lib/api-error-message.js';

describe('isGovernanceGateErrorCode', () => {
  it('matches impact and governance codes', () => {
    expect(isGovernanceGateErrorCode('impact_gate_blocked')).toBe(true);
    expect(isGovernanceGateErrorCode('shacl_validation_failed')).toBe(true);
    expect(isGovernanceGateErrorCode('not_found')).toBe(false);
  });
});

describe('readApiErrorCode', () => {
  it('reads code from Error metadata', () => {
    const err = new Error('x');
    (err as Error & { code?: string }).code = 'impact_gate_blocked';
    expect(readApiErrorCode(err)).toBe('impact_gate_blocked');
  });
});
