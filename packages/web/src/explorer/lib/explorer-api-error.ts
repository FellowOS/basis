import { errorFromApiResponse } from '@/lib/api-error.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';

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
export function explorerApiErrorMessage(err: unknown, locale: 'en' | 'zh' = 'en'): string {
  return formatUserFacingApiError(err, locale);
}
