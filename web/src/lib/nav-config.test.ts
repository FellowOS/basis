import { describe, expect, it } from 'vitest';

import { kbOntologyProposalPath } from '@/lib/nav-config.js';

describe('kbOntologyProposalPath', () => {
  it('opens ontology versions tab with proposal query', () => {
    expect(kbOntologyProposalPath('kb-1', 'prop-42')).toBe(
      '/kbs/kb-1/ontology-versions?ontologyTab=versions&ontologyProposal=prop-42',
    );
  });
});
