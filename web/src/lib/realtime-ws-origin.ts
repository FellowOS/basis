/** WebSocket origin for workspace graph-updates (dev: direct to API; prod: same host as the SPA). */
export function realtimeWsOrigin(): string {
  if (!import.meta.env.DEV) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  const httpBase =
    (import.meta.env.VITE_BASIS_API_URL as string | undefined)?.trim() ||
    'http://127.0.0.1:8090';
  const parsed = new URL(httpBase);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return parsed.origin;
}
