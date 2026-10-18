import { Hono } from 'hono';
import type { Context } from 'hono';
import { proxy } from 'hono/proxy';

import { basisApiTarget } from './config.ts';

/** Reverse-proxy Basis HTTP routes (browser same-origin). WebSocket upgrades: attach-basis-ws-proxy.ts */
export function mountBasisHttpProxy(app: Hono, apiTarget = basisApiTarget()) {
  const forward = (c: Context) => {
    const incoming = new URL(c.req.url);
    const target = `${apiTarget}${incoming.pathname}${incoming.search}`;
    return proxy(target, c.req.raw);
  };

  app.all('/api/*', forward);
  app.all('/health', forward);
  app.all('/openapi.json', forward);
  app.all('/openapi/*', forward);
}

export function createWebApp() {
  const app = new Hono();

  mountBasisHttpProxy(app);

  return app;
}
