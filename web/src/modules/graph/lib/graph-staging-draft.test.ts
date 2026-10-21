import { afterEach, describe, expect, it } from 'vitest';
import {
  clearGraphStagingDraft,
  readGraphStagingDraft,
  writeGraphStagingDraft,
} from '@/modules/graph/lib/graph-staging-draft.js';

describe('graph-staging-draft', () => {
  afterEach(() => {
    clearGraphStagingDraft('sess-1');
  });

  it('round-trips merge pick in sessionStorage', () => {
    writeGraphStagingDraft('sess-1', { primary: 'a', duplicate: 'b' });
    expect(readGraphStagingDraft('sess-1')).toEqual({ primary: 'a', duplicate: 'b' });
    clearGraphStagingDraft('sess-1');
    expect(readGraphStagingDraft('sess-1')).toBeNull();
  });
});
