import assert from 'node:assert/strict';
import { createApiServer } from '../../apps/api/src/server.js';
import type { HostedConfig } from '../../apps/api/src/access.js';
import { TareService } from '../../packages/service/src/index.js';

export async function withApi(run: (url: string) => Promise<void>, service = new TareService(), hosted?: HostedConfig) {
  const server = createApiServer(service, hosted);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

export function post(url: string, action: string, input: unknown, headers: Record<string, string> = {}) {
  return fetch(`${url}/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(input) });
}
