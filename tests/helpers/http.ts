import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type Handler = (body: unknown, response: ServerResponse, request: IncomingMessage) => void;

export function json(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

export async function withServer(handler: Handler, run: (url: string) => Promise<void>): Promise<void> {
  const server = createServer((request, response) => {
    // Short-lived fixtures can reuse ports; do not pool sockets across fixtures.
    response.setHeader('connection', 'close');
    let body = '';
    request.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    request.on('end', () => handler(body ? JSON.parse(body) as unknown : undefined, response, request));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}
