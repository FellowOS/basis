import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';

function lookupApiErrorCode(locale: Locale, code: string): string | undefined {
  const messages = messagesForLocale(locale).apiErrorCodes as Record<string, string>;
  return messages[code];
}

export type ApiErrorLike = {
  message?: string;
  code?: string;
  requestId?: string;
};

function withRequestIdSuffix(
  text: string,
  requestId: string | undefined,
  locale: Locale,
): string {
  const id = requestId?.trim();
  if (!id) {
    return text;
  }
  const suffix = messagesForLocale(locale).common.apiReferenceIdSuffix;
  return `${text}${fmt(suffix, { id })}`;
}

export function messageForApiErrorCode(
  code: string | null | undefined,
  locale: Locale,
): string | null {
  if (!code?.trim()) {
    return null;
  }
  const mapped = lookupApiErrorCode(locale, code.trim());
  if (mapped) {
    return mapped;
  }
  return fmt(messagesForLocale(locale).common.apiErrorCode, { code: code.trim() });
}

export function formatUserFacingApiError(
  err: unknown,
  locale: Locale,
): string {
  const fallback = messagesForLocale(locale).common.apiTryAgain;
  if (!(err instanceof Error)) {
    return fallback;
  }
  const meta = err as Error & ApiErrorLike;
  const code = meta.code;
  const requestId = meta.requestId;
  if (code) {
    const mapped = lookupApiErrorCode(locale, code);
    if (mapped) {
      return withRequestIdSuffix(mapped, requestId, locale);
    }
  }
  if (code?.trim()) {
    const mapped = messageForApiErrorCode(code, locale) ?? fallback;
    return withRequestIdSuffix(mapped, requestId, locale);
  }
  if (err.message.trim()) {
    return withRequestIdSuffix(err.message, requestId, locale);
  }
  return withRequestIdSuffix(fallback, requestId, locale);
}
