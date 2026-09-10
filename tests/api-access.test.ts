import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { ApiAccess, accessFromEnv } from '../apps/api/src/access.js';
import { ServiceError } from '../packages/service/src/requests.js';
import { withApi } from './helpers/api.js';

const hosted = { origin: 'https://tare.test', keys: { alpha: 'a'.repeat(40), beta: 'b'.repeat(40) }, requestsPerMinute: 2 };

function send(url: string, path: string, headers: Record<string, string> = {}, body?: string) {
  return new Promise<{ status: number; headers: IncomingMessage['headers']; body: string }>((resolve, reject) => {
    const req = request(`${url}${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { host: 'tare.test', ...headers } }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body: text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('hosted API authenticates before parsing bodies and isolates client quotas', async () => {
  await withApi(async url => {
    const anonymous = await send(url, '/api/status');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.headers['www-authenticate'], 'Bearer realm="tare"');
    assert.equal((await send(url, '/api/replay', { 'content-type': 'application/json' }, '{')).status, 401);
    assert.equal((await send(url, '/api/status', { authorization: `Bearer ${'x'.repeat(40)}` })).status, 401);
    const first = { authorization: `Bearer ${hosted.keys.alpha}` };
    const second = { authorization: `Bearer ${hosted.keys.beta}` };
    assert.equal((await send(url, '/api/status', first)).status, 200);
    const example = await send(url, '/api/example', { ...first, 'content-type': 'application/json' }, '{"id":"weth-custody"}');
    assert.equal(example.status, 200);
    assert.equal(JSON.parse(example.body).sourceMode, 'recorded-rpc');
    const limited = await send(url, '/api/status', first);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers['retry-after'], '60');
    assert.equal((await send(url, '/api/status', second)).status, 200);
    const contract = await send(url, '/openapi.json');
    const schema = JSON.parse(contract.body);
    assert.deepEqual(schema.security, [{ bearerAuth: [] }]);
    assert.deepEqual(schema.servers, [{ url: hosted.origin }]);
    assert.equal(schema.components.securitySchemes.bearerAuth.scheme, 'bearer');
    for (const text of [anonymous.body, example.body, limited.body, contract.body]) {
      assert.ok(!text.includes(hosted.keys.alpha) && !text.includes(hosted.keys.beta));
    }
  }, undefined, hosted);
});

test('hosted origin checks ignore spoofed proxy headers and protect every API operation', async () => {
  await withApi(async url => {
    const authorization = `Bearer ${hosted.keys.alpha}`;
    for (const headers of [
      { host: 'attacker.test', 'x-forwarded-host': 'tare.test' },
      { origin: 'https://attacker.test' }, { origin: 'http://tare.test' },
      { 'sec-fetch-site': 'cross-site' },
    ]) assert.equal((await send(url, '/api/status', { authorization, ...headers })).status, 403);
    for (const name of ['analyze', 'replay', 'example', 'compose']) {
      assert.equal((await send(url, `/api/${name}`, { 'content-type': 'application/json' }, '{}')).status, 401);
    }
    assert.equal((await send(url, '/api/status', { authorization, origin: hosted.origin })).status, 200);
    assert.equal((await send(url, '/')).status, 200);
  }, undefined, hosted);
});

test('client quotas reset without accumulating arbitrary identities; access config fails closed', () => {
  let now = 0;
  const access = new ApiAccess(hosted, () => now);
  const request = { headers: { host: 'tare.test', authorization: `Bearer ${hosted.keys.alpha}` }, socket: {} } as IncomingMessage;
  access.check(request, true);
  access.check(request, true);
  assert.throws(() => access.check(request, true), (error: unknown) => error instanceof ServiceError && error.code === 'rate-limited');
  now = 60000;
  access.check(request, true);
  assert.equal(accessFromEnv({}), undefined);
  for (const input of [
    { TARE_PUBLIC_ORIGIN: 'https://tare.test' }, { TARE_API_KEYS: 'SECRET malformed JSON' },
    { TARE_PUBLIC_ORIGIN: 'http://tare.test', TARE_API_KEYS: JSON.stringify(hosted.keys) },
    { TARE_PUBLIC_ORIGIN: hosted.origin, TARE_API_KEYS: JSON.stringify({ alpha: 'short' }) },
    { TARE_PUBLIC_ORIGIN: hosted.origin, TARE_API_KEYS: JSON.stringify({ ...hosted.keys, beta: hosted.keys.alpha }) },
  ]) assert.throws(() => accessFromEnv(input), (error: unknown) => error instanceof Error && !error.message.includes('SECRET'));
});
