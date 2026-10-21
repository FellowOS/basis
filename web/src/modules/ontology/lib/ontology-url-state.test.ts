import { describe, expect, it } from 'vitest';
import { applyEntitySelection, applyTab, parseOntologyUrlState } from './ontology-url-state.js';

describe('parseOntologyUrlState', () => {
  it('reads proposal deep link via legacy ontologyTab', () => {
    const state = parseOntologyUrlState(
      '?ontologyTab=versions&ontologyProposal=prop-abc&ontologyEntity=http%3A%2F%2Fex',
    );
    expect(state.tab).toBe('versions');
    expect(state.proposalId).toBe('prop-abc');
    expect(state.entityUri).toBe('http://ex');
  });

  it('reads hub tab=versions for proposal links', () => {
    const state = parseOntologyUrlState('?tab=versions&ontologyProposal=prop-hub');
    expect(state.tab).toBe('versions');
    expect(state.proposalId).toBe('prop-hub');
  });

  it('maps tab=model to registry', () => {
    expect(parseOntologyUrlState('?tab=model').tab).toBe('registry');
  });
});

describe('applyTab', () => {
  it('writes canonical tab param and drops legacy ontologyTab', () => {
    expect(applyTab('?ontologyTab=editor&foo=1', 'editor')).toBe('?foo=1&tab=editor');
  });

  it('omits tab param for registry default', () => {
    expect(applyTab('?tab=editor', 'registry')).toBe('?');
  });
});

describe('applyEntitySelection', () => {
  it('opens editor with entity uri', () => {
    expect(applyEntitySelection('', 'http://ex#C')).toBe(
      '?tab=editor&ontologyEntity=http%3A%2F%2Fex%23C',
    );
  });
});
