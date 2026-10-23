import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

import { attachDevWebSocketUpgrades } from './attach-basis-ws-proxy.ts';
import { basisApiTarget, viteHmrPort, webListenHost, webListenPort } from './config.ts';
import { createWebApp } from './create-app.ts';
import { loadWebEnv } from './load-env.ts';
import { isHonoHandledPath } from './proxy-paths.ts';

loadWebEnv();

const root = path.dirname(fileURLToPath(import.meta.url));
const honoListener = getRequestListener(createWebApp().fetch);

const hmrPort = viteHmrPort();
const vite: ViteDevServer = await createViteServer({
  configFile: path.resolve(root, '../vite.config.ts'),
  server: {
    middlewareMode: true,
    // Per listen port so dev (5173→24678) and E2E (5174→24679) can run together.
    hmr: { port: hmrPort, clientPort: hmrPort },
  },
  appType: 'spa',
});

const server = http.createServer((req, res) => {
  const pathname = req.url?.split('?')[0] ?? '';
  if (isHonoHandledPath(pathname)) {
    honoListener(req, res);
    return;
  }
  vite.middlewares(req, res);
});

attachDevWebSocketUpgrades(server, basisApiTarget(), vite);

server.listen(webListenPort(), webListenHost(), () => {
  console.log(`Basis web (Hono + Vite) http://${webListenHost()}:${webListenPort()}`);
});
