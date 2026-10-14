import { describe, expect, it } from 'vitest';

import { errorFromApiResponse } from './api-error.js';
import { formatUserFacingApiError } from './api-error-message.js';

describe('errorFromApiResponse', () => {
  it('attaches detail code without leaking server message', () => {
    const err = errorFromApiResponse(409, {
      detail: { code: 'processing_active', message: '该版本已在处理中' },
    });
    expect(err.message).toBe('');
    expect((err as Error & { code?: string }).code).toBe('processing_active');
    expect(formatUserFacingApiError(err, 'en')).toContain('already being processed');
  });

  it('keeps message when no code is provided', () => {
    const err = errorFromApiResponse(400, { detail: 'Bad input' });
    expect(err.message).toBe('Bad input');
  });
});
