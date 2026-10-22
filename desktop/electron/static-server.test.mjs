import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { startStaticServer } from './static-server.mjs';

function listenMockApi(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('startStaticServer', () => {
  let rootDir;
  let staticSrv;
  let staticUrl;
  let apiSrv;
  let apiUrl;

  before(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'basis-static-'));
    fs.writeFileSync(path.join(rootDir, 'index.html'), '<!doctype html><title>spa</title>');
    fs.mkdirSync(path.join(rootDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'assets', 'app.js'), 'console.log("ok")');

    apiSrv = await listenMockApi((req, res) => {
      if (req.url === '/api/v1/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status":"ok"}');
        return;
      }
      res.writeHead(404);
      res.end();
    });
    apiUrl = apiSrv.url;

    const started = await startStaticServer(rootDir, {
      host: '127.0.0.1',
      port: 0,
      apiProxyTarget: apiUrl,
    });
    staticSrv = started.server;
    staticUrl = started.url;
  });

  after(() => {
    staticSrv?.close();
    apiSrv?.server.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('serves index.html for SPA routes', async () => {
    const res = await fetch(`${staticUrl}/workspaces/ws-1/graph`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /spa/);
  });

  it('returns 404 for missing asset paths (not SPA HTML)', async () => {
    const res = await fetch(`${staticUrl}/assets/missing-chunk.js`);
    assert.equal(res.status, 404);
    const body = await res.text();
    assert.doesNotMatch(body, /spa/);
  });

  it('proxies /api to apiProxyTarget', async () => {
    const res = await fetch(`${staticUrl}/api/v1/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });

  it('proxies /openapi to apiProxyTarget', async () => {
    apiSrv.server.removeAllListeners('request');
    apiSrv.server.on('request', (req, res) => {
      if (req.url === '/openapi/v1.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"openapi":"3.1.0"}');
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const res = await fetch(`${staticUrl}/openapi/v1.json`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { openapi: '3.1.0' });
  });
});

describe('startStaticServer without API proxy', () => {
  let rootDir;
  let staticSrv;
  let staticUrl;

  before(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'basis-static-noproxy-'));
    fs.writeFileSync(path.join(rootDir, 'index.html'), 'x');
    const started = await startStaticServer(rootDir, { host: '127.0.0.1', port: 0 });
    staticSrv = started.server;
    staticUrl = started.url;
  });

  after(() => {
    staticSrv?.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('returns 502 for /api when proxy is not configured', async () => {
    const res = await fetch(`${staticUrl}/api/v1/health`);
    assert.equal(res.status, 502);
    assert.match(await res.text(), /not configured/i);
  });
});
