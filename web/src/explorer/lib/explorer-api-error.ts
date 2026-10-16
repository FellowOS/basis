import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';
import { errorFromApiResponse } from '@/lib/api-error.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { explorerFetch } from '../host/explorerHttp';

function explorerMessages(locale: Locale = 'en') {
  return messagesForLocale(locale).common;
}

export type ExplorerJsonBody = { message?: string };

export async function throwIfExplorerNotOk(
  response: Response,
  fallbackMessage?: string,
): Promise<void> {
  if (response.ok) {
    return;
  }
  const data = await response.json().catch(() => ({}));
  throw errorFromApiResponse(response.status, data, fallbackMessage);
}

export async function parseExplorerJson<T>(
  response: Response,
  fallbackMessage?: string,
): Promise<T> {
  await throwIfExplorerNotOk(response, fallbackMessage);
  return (await response.json()) as T;
}

/** Explorer surfaces are English-first; KB shell pages pass locale explicitly. */
export function explorerApiErrorMessage(err: unknown, locale: Locale = 'en'): string {
  return formatUserFacingApiError(err, locale);
}

export function explorerPartialSuccessWarning(
  response: Response,
  data: unknown,
  fallback: string,
): string | null {
  if (response.status !== 207) {
    return null;
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const message = (data as ExplorerJsonBody).message?.trim();
    if (message) {
      return message;
    }
  }
  return fallback;
}

export async function explorerGetJson<T>(
  url: string,
  init?: RequestInit,
  options?: { fallbackMessage?: string; partialWarning?: string; locale?: Locale },
): Promise<{ data: T; partialWarning: string | null }> {
  const response = await explorerFetch(url, init);
  const locale = options?.locale ?? 'en';
  const common = explorerMessages(locale);
  const fallback =
    options?.fallbackMessage ?? fmt(common.requestFailedStatus, { status: response.status });
  const data = await parseExplorerJson<T>(response, fallback);
  return {
    data,
    partialWarning: explorerPartialSuccessWarning(
      response,
      data,
      options?.partialWarning ?? common.partialSuccess,
    ),
  };
}

/** After POST/PATCH/DELETE: throws on failure; surfaces 207 as optional warning text. */
export async function explorerMutationResult(
  response: Response,
  fallbackMessage: string,
  partialWarningFallback?: string,
  locale: Locale = 'en',
): Promise<string | null> {
  const partialFallback = partialWarningFallback ?? explorerMessages(locale).partialSuccess;
  await throwIfExplorerNotOk(response, fallbackMessage);
  if (response.status !== 207) {
    return null;
  }
  const data = await response.json().catch(() => ({}));
  return explorerPartialSuccessWarning(response, data, partialFallback);
}
