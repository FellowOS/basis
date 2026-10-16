import { useCallback } from 'react';
import { useI18n } from '@/i18n/context.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';

/** Locale-aware API error text for shell UI (X-01 coded errors). */
export function useApiErrorMessage() {
  const { locale } = useI18n();
  return useCallback((err: unknown) => formatUserFacingApiError(err, locale), [locale]);
}
