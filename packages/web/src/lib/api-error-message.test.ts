import { describe, expect, it } from 'vitest';

import { formatUserFacingApiError, messageForApiErrorCode } from './api-error-message.js';

describe('formatUserFacingApiError', () => {
  it('maps known processing codes', () => {
    const err = new Error('raw');
    (err as Error & { code?: string }).code = 'processing_active';
    expect(formatUserFacingApiError(err, 'en')).toContain('already being processed');
  });

  it('falls back to error message', () => {
    expect(formatUserFacingApiError(new Error('Custom'), 'zh')).toBe('Custom');
  });

  it('maps projection error codes by code only', () => {
    expect(messageForApiErrorCode('build_failed', 'en')).toContain('projection');
    const err = new Error('server raw');
    (err as Error & { code?: string }).code = 'ingest_incomplete';
    expect(formatUserFacingApiError(err, 'zh')).toContain('过期');
  });

  it('maps explorer semantic codes', () => {
    expect(messageForApiErrorCode('semantic_unavailable', 'en')).toContain('Semantic');
    expect(messageForApiErrorCode('bad_path', 'zh')).toContain('source');
  });

  it('maps ingest limit codes', () => {
    expect(messageForApiErrorCode('upload_too_large', 'zh')).toContain('大小');
    expect(messageForApiErrorCode('extract_timeout', 'en')).toContain('timed out');
    expect(messageForApiErrorCode('too_many_chunks', 'zh')).toContain('块数');
  });

  it('maps auth codes without surfacing raw server text', () => {
    const err = new Error('');
    (err as Error & { code?: string }).code = 'invalid_credentials';
    expect(formatUserFacingApiError(err, 'zh')).toContain('密码');
    expect(formatUserFacingApiError(err, 'en')).toContain('password');
  });
});
