import type { ExplorerHttpConfig } from '@/explorer/host/explorerHttp.js';
import { fmt } from '@/i18n/format.js';
import { localeFromBrowser, type Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';
import { getToken } from '@/lib/api.js';
import { errorFromApiResponse } from '@/lib/api-error.js';
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
    apiRoot: `/api/kbs/${kbId}`,
    getAuthHeaders: (): Record<string, string> => {
      const token = getToken();
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };
    },
    openGraphUpdatesSocket: async () => {
      const token = getToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const ticketResp = await fetch(`/api/kbs/${kbId}/realtime-ticket`, {
        method: 'POST',
        headers,
      });
      if (!ticketResp.ok) {
        const body = await ticketResp.json().catch(() => ({}));
        throw errorFromApiResponse(
          ticketResp.status,
          body,
          fmt(messagesForLocale(loc).kbExplorer.realtimeTicketFailed, {
            status: ticketResp.status,
          }),
          loc,
        );
      }
      const body = (await ticketResp.json()) as { ticket: string };
      const url = `${realtimeWsOrigin()}/api/kbs/${kbId}/ws/graph-updates?ticket=${encodeURIComponent(body.ticket)}`;
      return new WebSocket(url);
    },
  };
}
