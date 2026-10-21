import { describe, expect, it } from 'vitest';

import { normalizeOntologyHubTabId, resolveOntologyHubTab } from '@/modules/analyze/lib/hub-tabs.js';

describe('resolveOntologyHubTab', () => {
  it('defaults to registry', () => {
    expect(resolveOntologyHubTab(null, null, false, false, null)).toBe('registry');
  });

  it('opens editor when entity deep link is present', () => {
    expect(resolveOntologyHubTab(null, null, false, true, null)).toBe('editor');
  });

  it('maps legacy model tab to registry', () => {
    expect(normalizeOntologyHubTabId('model')).toBe('registry');
  });
});
