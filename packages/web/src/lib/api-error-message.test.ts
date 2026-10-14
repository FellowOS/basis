import { describe, expect, it } from 'vitest';

import { formatUserFacingApiError } from './api-error-message.js';

describe('formatUserFacingApiError', () => {
  it('maps known processing codes', () => {
    const err = new Error('raw');
    (err as Error & { code?: string }).code = 'processing_active';
    expect(formatUserFacingApiError(err, 'en')).toContain('already being processed');
  });

  it('falls back to error message', () => {
    expect(formatUserFacingApiError(new Error('Custom'), 'zh')).toBe('Custom');
  });
});
