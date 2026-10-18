import { describe, expect, it } from 'vitest';

import { kbEntitiesStatementPath, parseEntitiesUrlState } from '@/lib/entitiesUrlState.js';

describe('entitiesUrlState', () => {
  it('parses statement deep link', () => {
    expect(parseEntitiesUrlState('?statement=stmt-1').statementId).toBe('stmt-1');
  });

  it('builds entities statement path', () => {
    expect(kbEntitiesStatementPath('kb-1', 'stmt-9')).toBe('/kbs/kb-1/entities?statement=stmt-9');
  });
});
