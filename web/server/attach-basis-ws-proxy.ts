import type http from 'node:http';
import httpProxy from 'http-proxy';
import type { ViteDevServer } from 'vite';

import { isBasisApiWebSocketPath } from './proxy-paths.ts';

export function attachBasisWebSocketProxy(server: http.Server, apiTarget: string): void {
  const wsProxy = httpProxy.createProxyServer({ target: apiTarget, ws: true });
  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (isBasisApiWebSocketPath(pathname)) {
      wsProxy.ws(req, socket, head);
    }
  });
}

/** Dev: Basis API WS + Vite HMR on the same HTTP server. */
export function attachDevWebSocketUpgrades(
  server: http.Server,
  apiTarget: string,
  vite: ViteDevServer,
): void {
  const wsProxy = httpProxy.createProxyServer({ target: apiTarget, ws: true });
  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url?.split('?')[0] ?? '';
    if (isBasisApiWebSocketPath(pathname)) {
      wsProxy.ws(req, socket, head);
      return;
    }
    const hot = (vite as { hot?: { handleUpgrade?: (req: http.IncomingMessage, socket: unknown, head: Buffer) => void } })
      .hot;
    if (hot?.handleUpgrade) {
      hot.handleUpgrade(req, socket, head);
      return;
    }
    socket.destroy();
  });
}
