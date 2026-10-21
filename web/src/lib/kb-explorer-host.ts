import type { ExplorerHttpConfig } from '@/ws/explorerHttp.js';
import { fmt } from '@/i18n/format.js';
import { localeFromBrowser, type Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';
import { getToken } from '@/lib/auth-token.js';
import type { ApiErrorWithMeta } from '@/lib/api-error.js';
import { errorFromApiResponse } from '@/lib/api-error.js';
import { kbApiRoot } from '@/lib/kb-api-path.js';
import { kbOpenApiPOST } from '@/lib/openapi-client.js';
import { realtimeWsOrigin } from '@/lib/realtime-ws-origin.js';

function resolveLocale(locale?: Locale): Locale {
  if (locale) {
    return locale;
  }
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return localeFromBrowser(lang);
}

export function buildKbExplorerHttpConfig(kbId: string, locale?: Locale): ExplorerHttpConfig {
  const loc = resolveLocale(locale);
  return {
    apiRoot: kbApiRoot(kbId),
    getAuthHeaders: (): Record<string, string> => {
      const token = getToken();
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };
    },
    openGraphUpdatesSocket: async () => {
      try {
        const body = await kbOpenApiPOST<{ ticket: string }>(kbId, 'realtime-ticket');
        const url = `${realtimeWsOrigin()}${kbApiRoot(kbId)}/ws/graph-updates?ticket=${encodeURIComponent(body.ticket)}`;
        return new WebSocket(url);
      } catch (err) {
        const apiErr = err as ApiErrorWithMeta;
        if (typeof apiErr.status === 'number') {
          throw errorFromApiResponse(
            apiErr.status,
            { detail: { message: apiErr.message, code: apiErr.code } },
            fmt(messagesForLocale(loc).kbExplorer.realtimeTicketFailed, {
              status: apiErr.status,
            }),
            loc,
          );
        }
        throw err;
      }
    },
  };
}
