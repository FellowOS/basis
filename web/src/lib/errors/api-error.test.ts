import { describe, expect, it } from 'vitest';

import { errorFromApiResponse } from './api-error.js';
import { formatUserFacingApiError } from './api-error-message.js';

describe('errorFromApiResponse', () => {
  it('attaches detail code and preserves server message for formatted output', () => {
    const err = errorFromApiResponse(409, {
      detail: { code: 'processing_active', message: '该版本已在处理中' },
    });
    expect(err.message).toBe('该版本已在处理中');
    expect((err as Error & { code?: string }).code).toBe('processing_active');
    const formatted = formatUserFacingApiError(err, 'en');
    expect(formatted).toContain('already being processed');
    expect(formatted).toContain('该版本已在处理中');
  });

  it('keeps message when no code is provided', () => {
    const err = errorFromApiResponse(400, { detail: 'Bad input' });
    expect(err.message).toBe('Bad input');
  });

  it('attaches request_id and surfaces it in formatted copy', () => {
    const err = errorFromApiResponse(401, {
      detail: { code: 'unauthorized', message: 'x', request_id: 'trace-99' },
    });
    expect((err as Error & { requestId?: string }).requestId).toBe('trace-99');
    expect(formatUserFacingApiError(err, 'en')).toContain('trace-99');
  });

  it('attaches HTTP status on the error object', () => {
    const err = errorFromApiResponse(503, { detail: 'Unavailable' });
    expect((err as Error & { status?: number }).status).toBe(503);
  });
});
