import { describe, expect, it } from 'vitest';
import { parseOntologyUrlState } from './ontologyUrlState.js';

describe('parseOntologyUrlState', () => {
  it('reads proposal deep link params', () => {
    const state = parseOntologyUrlState(
      '?ontologyTab=versions&ontologyProposal=prop-abc&ontologyEntity=http%3A%2F%2Fex',
    );
    expect(state.tab).toBe('versions');
    expect(state.proposalId).toBe('prop-abc');
    expect(state.entityUri).toBe('http://ex');
  });
});
