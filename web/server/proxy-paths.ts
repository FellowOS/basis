/** Paths served by Hono (Basis reverse proxy), not Vite. */

export function isHonoHandledPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) {
    return true;
  }
  if (pathname === '/health') {
    return true;
  }
  if (pathname === '/openapi.json' || pathname.startsWith('/openapi/')) {
    return true;
  }
  return false;
}

export function isBasisApiWebSocketPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}
