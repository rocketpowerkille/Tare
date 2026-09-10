import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { TareService } from '../../../packages/service/src/index.js';
import { MAX_INPUT_BYTES, ServiceError, publicError } from '../../../packages/service/src/requests.js';
import { openapi } from './openapi.js';

const assets = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/style.css', { file: 'style.css', type: 'text/css; charset=utf-8' }],
]);

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage) {
  if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw new ServiceError(415, 'content-type', 'Use application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const bytes = Buffer.from(chunk as Uint8Array);
    size += bytes.length;
    if (size > MAX_INPUT_BYTES) throw new ServiceError(413, 'input-too-large', 'Input exceeds the 5 MiB limit.');
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function checkOrigin(request: IncomingMessage) {
  const port = request.socket.localPort;
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!hosts.includes(request.headers.host ?? '')
    || (request.headers.origin && !hosts.some(host => request.headers.origin === `http://${host}`))
    || request.headers['sec-fetch-site'] === 'cross-site') {
    throw new ServiceError(403, 'untrusted-origin', 'This service accepts local requests only.');
  }
}

export function createApiServer(service = new TareService()) {
  const server = createServer({ requestTimeout: 15000, headersTimeout: 10000, maxHeaderSize: 8192 }, (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('connection', 'close');
    response.setHeader('content-security-policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    void route(request, response).catch(error => {
      const failure = publicError(error);
      if (!response.headersSent && !response.destroyed) json(response, failure.status, { error: { code: failure.code, message: failure.message } });
      else response.destroy();
    });
  });
  // A slow or abandoned request cannot keep a local socket open indefinitely.
  server.setTimeout(310000, socket => socket.destroy());

  async function route(request: IncomingMessage, response: ServerResponse) {
    checkOrigin(request);
    const path = request.url ?? '';
    if (path === '/api/status' || path === '/openapi.json' || assets.has(path)) {
      if (request.method !== 'GET') throw new ServiceError(405, 'method-not-allowed', 'Use GET.');
      if (path === '/api/status') return json(response, 200, service.capabilities());
      if (path === '/openapi.json') return json(response, 200, openapi);
      const asset = assets.get(path)!;
      const data = await readFile(new URL(`../../../../apps/web/${asset.file}`, import.meta.url));
      response.writeHead(200, { 'content-type': asset.type });
      response.end(data);
      return;
    }
    const action = path.slice('/api/'.length);
    if (!path.startsWith('/api/') || (action !== 'analyze' && action !== 'replay' && action !== 'example')) {
      throw new ServiceError(404, 'not-found', 'Unknown route.');
    }
    if (request.method !== 'POST') throw new ServiceError(405, 'method-not-allowed', 'Use POST.');
    json(response, 200, await service.run(action, await readBody(request)));
  }
  return server;
}
