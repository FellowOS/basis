import type { ExplorerHttpConfig } from '@/explorer/host/explorerHttp.js';
import { getToken } from '@/lib/api.js';

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
        throw new Error(`realtime ticket failed (${ticketResp.status})`);
      }
      const body = (await ticketResp.json()) as { ticket: string };
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/api/kbs/${kbId}/ws/graph-updates?ticket=${encodeURIComponent(body.ticket)}`;
      return new WebSocket(url);
    },
  };
}
