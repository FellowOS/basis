/** Client-side correlation IDs (paired with API `X-Request-ID`). */

export function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

export function ensureRequestIdHeader(headers: Headers): void {
  if (!headers.has('X-Request-ID')) {
    headers.set('X-Request-ID', newClientRequestId());
  }
}
