import { describe, expect, it } from 'vitest';

import { isKbScopedApiPath, kbApiPath, kbApiRoot } from '@/lib/kb-api-path.js';

describe('kbApiPath', () => {
  it('builds v1 KB roots and subpaths', () => {
    expect(kbApiRoot('kb-1')).toBe('/api/v1/kbs/kb-1');
    expect(kbApiPath('kb-1', 'search/config')).toBe('/api/v1/kbs/kb-1/search/config');
  });

  it('detects scoped paths', () => {
    expect(isKbScopedApiPath('/api/v1/kbs/x/graph/stats')).toBe(true);
    expect(isKbScopedApiPath('/api/kbs/x/graph/stats')).toBe(false);
    expect(isKbScopedApiPath('/api/graph/stats')).toBe(false);
  });
});
