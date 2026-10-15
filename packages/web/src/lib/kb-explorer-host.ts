import type { ExplorerHttpConfig } from '@/explorer/host/explorerHttp.js';
import { getToken } from '@/lib/api.js';
import { errorFromApiResponse } from '@/lib/api-error.js';
import { realtimeWsOrigin } from '@/lib/realtime-ws-origin.js';

export function buildKbExplorerHttpConfig(kbId: string): ExplorerHttpConfig {
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
          `realtime ticket failed (${ticketResp.status})`,
        );
      }
      const body = (await ticketResp.json()) as { ticket: string };
      const url = `${realtimeWsOrigin()}/api/kbs/${kbId}/ws/graph-updates?ticket=${encodeURIComponent(body.ticket)}`;
      return new WebSocket(url);
    },
  };
}
