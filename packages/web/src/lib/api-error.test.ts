import { describe, expect, it } from 'vitest';

import { errorFromApiResponse } from './api-error.js';

describe('errorFromApiResponse', () => {
  it('attaches detail code to Error', () => {
    const err = errorFromApiResponse(409, {
      detail: { code: 'processing_active', message: 'busy' },
    });
    expect(err.message).toBe('busy');
    expect((err as Error & { code?: string }).code).toBe('processing_active');
  });
});
