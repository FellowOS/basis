import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function isApiPath(pathname) {
  return pathname.startsWith('/api/') || pathname.startsWith('/openapi');
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} apiBase
 */
function proxyToApi(req, res, apiBase) {
  const base = apiBase.replace(/\/$/, '');
  const incoming = req.url ?? '/';
  const targetUrl = new URL(incoming, `${base}/`);

  const headers = { ...req.headers, host: targetUrl.host };
  delete headers.connection;

  const proxyReq = http.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Bad Gateway: ${err.message}`);
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
}

/**
 * @param {string} rootDir
 * @param {{ host?: string; port?: number; apiProxyTarget?: string }} opts
 */
export function startStaticServer(rootDir, opts = {}) {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 0;
  const apiProxyTarget = opts.apiProxyTarget?.trim().replace(/\/$/, '') ?? '';

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const raw = req.url?.split('?')[0] ?? '/';
      const safe = path.normalize(raw).replace(/^(\.\.(\/|\\|$))+/, '');

      if (isApiPath(safe)) {
        if (apiProxyTarget) {
          proxyToApi(req, res, apiProxyTarget);
          return;
        }
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('API proxy not configured');
        return;
      }

      let filePath = path.join(rootDir, safe === '/' ? 'index.html' : safe);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const looksLikeAsset = /\.[a-z0-9]{1,8}$/i.test(safe) && safe !== '/';
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        if (looksLikeAsset) {
          res.writeHead(404);
          res.end();
          return;
        }
        filePath = path.join(rootDir, 'index.html');
      }
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
      fs.createReadStream(filePath)
        .on('error', () => {
          res.writeHead(404);
          res.end();
        })
        .pipe(res);
    });

    server.on('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const listenPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ server, url: `http://${host}:${listenPort}` });
    });
  });
}
