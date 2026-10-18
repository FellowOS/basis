import { describe, expect, it } from 'vitest';

import { resolveOntologyHubTab } from '@/lib/kb-hub-tabs.js';

describe('kb-hub-tabs', () => {
  it('opens versions when ontologyProposal is present', () => {
    expect(
      resolveOntologyHubTab(null, null, true, {
        graph: true,
        explorer_runtime: true,
      } as never),
    ).toBe('versions');
  });
});
