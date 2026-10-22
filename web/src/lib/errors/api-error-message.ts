import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';

function lookupApiErrorCode(locale: Locale, code: string): string | undefined {
  const messages = messagesForLocale(locale).core.api_error_codes as Record<string, string>;
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
  const suffix = messagesForLocale(locale).core.common.apiReferenceIdSuffix;
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
  return fmt(messagesForLocale(locale).core.common.apiErrorCode, { code: code.trim() });
}

export function readApiErrorCode(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const code = (err as Error & ApiErrorLike).code;
  return code?.trim() || undefined;
}

/** True when a failed mutation likely emitted or relates to `governance.tripped` (F-GOV-05). */
export function isGovernanceGateErrorCode(code: string | undefined): boolean {
  if (!code) return false;
  const normalized = code.toLowerCase();
  return (
    normalized.includes('governance') ||
    normalized.includes('impact') ||
    normalized.includes('tripped') ||
    normalized.includes('shacl')
  );
}

export function formatUserFacingApiError(
  err: unknown,
  locale: Locale,
): string {
  const fallback = messagesForLocale(locale).core.common.apiTryAgain;
  if (!(err instanceof Error)) {
    return fallback;
  }
  const meta = err as Error & ApiErrorLike;
  const code = meta.code;
  const requestId = meta.requestId;
  const detailText = err.message.trim();
  const detailSep = locale === 'zh' ? '：' : ': ';
  if (code) {
    const mapped = lookupApiErrorCode(locale, code);
    if (mapped) {
      const text = detailText ? `${mapped}${detailSep}${detailText}` : mapped;
      return withRequestIdSuffix(text, requestId, locale);
    }
  }
  if (code?.trim()) {
    const mapped = messageForApiErrorCode(code, locale) ?? fallback;
    const text = detailText ? `${mapped}${detailSep}${detailText}` : mapped;
    return withRequestIdSuffix(text, requestId, locale);
  }
  if (err.message.trim()) {
    return withRequestIdSuffix(err.message, requestId, locale);
  }
  return withRequestIdSuffix(fallback, requestId, locale);
}
