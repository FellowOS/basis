import { localeFromBrowser, type Locale } from '@/i18n/locale.js';
import { requestFailedStatusMessage } from '@/i18n/format.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';

function resolveApiErrorLocale(locale?: Locale): Locale {
  if (locale) {
    return locale;
  }
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return localeFromBrowser(lang);
}

export type ApiErrorDetail = {
  code?: string;
  message?: string;
  request_id?: string;
};

export type ApiErrorWithMeta = Error & {
  code?: string;
  requestId?: string;
  status?: number;
};

export function errorFromApiResponse(
  status: number,
  data: unknown,
  fallbackMessage?: string,
  locale?: Locale,
): Error {
  const raw = (data as { detail?: ApiErrorDetail | string })?.detail;
  const detail: ApiErrorDetail =
    typeof raw === 'string' ? { message: raw } : (raw ?? {});
  const resolvedLocale = resolveApiErrorLocale(locale);
  const defaultMessage =
    fallbackMessage
    || (status === 401 || status === 403
      ? messagesForLocale(resolvedLocale).common.signInRequired
      : requestFailedStatusMessage(resolvedLocale, status));
  // When the API sends a stable code, UI should map via the registry — not show raw server text.
  const err = new Error(
    detail.code
      ? ''
      : (detail.message?.trim() || defaultMessage),
  );
  const meta = err as ApiErrorWithMeta;
  meta.status = status;
  if (detail.code) {
    meta.code = detail.code;
  }
  const requestId = detail.request_id?.trim();
  if (requestId) {
    meta.requestId = requestId;
  }
  return err;
}

export async function throwIfApiNotOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  const data = await response.json().catch(() => ({}));
  throw errorFromApiResponse(response.status, data);
}
