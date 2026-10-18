import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { attachBasisWebSocketProxy } from './attach-basis-ws-proxy.ts';
import { basisApiTarget, webListenHost, webListenPort, webStaticRoot } from './config.ts';
import { createWebApp } from './create-app.ts';
import { loadWebEnv } from './load-env.ts';

loadWebEnv();

const staticRoot = path.resolve(webStaticRoot());
const indexPath = path.join(staticRoot, 'index.html');

const app = createWebApp();

app.use('*', serveStatic({ root: staticRoot }));
app.get('*', (c) => {
  if (fs.existsSync(indexPath)) {
    return c.html(fs.readFileSync(indexPath, 'utf8'));
  }
  return c.text('Web assets not found; run npm run build', 503);
});

const server = serve(
  {
    fetch: app.fetch,
    port: webListenPort(),
    hostname: webListenHost(),
  },
  (info) => {
    console.log(`Basis web (Hono) http://${info.address}:${info.port}`);
  },
);

attachBasisWebSocketProxy(server as unknown as http.Server, basisApiTarget());
