import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { ApiAccess, accessFromEnv } from '../apps/api/src/access.js';
import { ServiceError } from '../packages/service/src/requests.js';
import { withApi } from './helpers/api.js';

const hosted = { origin: 'https://tare.test', keys: { alpha: 'a'.repeat(40), beta: 'b'.repeat(40) }, requestsPerMinute: 2 };
const sandboxHosted = {
  origin: 'https://tare.test',
  keys: { bazantic: 'g'.repeat(40), member: 'm'.repeat(40) },
  requestsPerMinute: 10,
  bazanticSandbox: {
    clientId: 'bazantic',
    sessionSecret: 's'.repeat(40),
    gatewayUrl: 'https://tare-sandbox.bazgateway.com',
    sessionMinutes: 1,
  },
};

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
    const health = await send(url, '/healthz');
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), { status: 'ok' });
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

test('Bazantic sandbox payment route issues a short-lived testnet-only Explorer session', async () => {
  await withApi(async url => {
    const options = await send(url, '/api/access-options');
    assert.equal(options.status, 200);
    assert.deepEqual(JSON.parse(options.body), {
      privateBeta: true,
      bazanticSandbox: {
        enabled: true,
        network: 'base-sepolia',
        gatewayUrl: sandboxHosted.bazanticSandbox.gatewayUrl,
        sessionPath: '/api/bazantic/session',
        sessionSeconds: 60,
      },
    });
    assert.ok(!options.body.includes(sandboxHosted.bazanticSandbox.sessionSecret));
    assert.ok(!options.body.includes(sandboxHosted.keys.bazantic));

    const jsonHeaders = { 'content-type': 'application/json' };
    assert.equal((await send(url, '/api/bazantic/session', jsonHeaders, '{}')).status, 401);
    assert.equal((await send(url, '/api/bazantic/session', {
      ...jsonHeaders, authorization: `Bearer ${sandboxHosted.keys.member}`,
    }, '{}')).status, 403);
    assert.equal((await send(url, '/api/bazantic/session', {
      ...jsonHeaders, authorization: `Bearer ${sandboxHosted.keys.bazantic}`,
    }, '{"network":"mainnet"}')).status, 400);

    const issued = await send(url, '/api/bazantic/session', {
      ...jsonHeaders, authorization: `Bearer ${sandboxHosted.keys.bazantic}`,
      origin: 'https://bazantic.com', 'sec-fetch-site': 'cross-site',
    }, '{}');
    assert.equal(issued.status, 200);
    const session = JSON.parse(issued.body) as { accessToken: string; network: string; expiresInSeconds: number };
    assert.match(session.accessToken, /^tare_sandbox_v1\./);
    assert.equal(session.network, 'base-sepolia');
    assert.equal(session.expiresInSeconds, 60);
    assert.equal((await send(url, '/api/status', { authorization: `Bearer ${session.accessToken}` })).status, 200);
    assert.equal((await send(url, '/api/status', {
      host: new URL(sandboxHosted.bazanticSandbox.gatewayUrl).host,
      authorization: `Bearer ${sandboxHosted.keys.bazantic}`,
      origin: sandboxHosted.bazanticSandbox.gatewayUrl,
    })).status, 200);
    assert.equal((await send(url, '/api/status', {
      authorization: `Bearer ${sandboxHosted.keys.member}`,
      origin: 'https://bazantic.com', 'sec-fetch-site': 'cross-site',
    })).status, 403);
    assert.equal((await send(url, '/api/status', {
      authorization: `Bearer ${sandboxHosted.keys.bazantic}`,
      origin: 'https://attacker.test', 'sec-fetch-site': 'cross-site',
    })).status, 403);
    const tampered = `${session.accessToken.slice(0, -1)}${session.accessToken.endsWith('a') ? 'b' : 'a'}`;
    assert.equal((await send(url, '/api/status', { authorization: `Bearer ${tampered}` })).status, 401);
  }, undefined, sandboxHosted);
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
  assert.deepEqual(accessFromEnv({
    RENDER: 'true', RENDER_EXTERNAL_URL: 'https://tare-api.onrender.com',
    TARE_API_KEYS: JSON.stringify(hosted.keys),
  })?.origin, 'https://tare-api.onrender.com');
});

test('Bazantic sandbox sessions expire and partial environment configuration fails closed', () => {
  let now = 1_000_000;
  const access = new ApiAccess(sandboxHosted, () => now);
  const gatewayRequest = { headers: { host: 'tare.test', authorization: `Bearer ${sandboxHosted.keys.bazantic}` }, socket: {} } as IncomingMessage;
  const identity = access.check(gatewayRequest, true);
  const issued = access.issueBazanticSession(identity);
  const sessionRequest = { headers: { host: 'tare.test', authorization: `Bearer ${issued.accessToken}` }, socket: {} } as IncomingMessage;
  assert.equal(access.check(sessionRequest, true)?.kind, 'bazantic-sandbox-session');
  now += 60_000;
  assert.throws(() => access.check(sessionRequest, true), (error: unknown) => error instanceof ServiceError && error.code === 'unauthorized');

  const parsed = accessFromEnv({
    TARE_PUBLIC_ORIGIN: sandboxHosted.origin,
    TARE_API_KEYS: JSON.stringify(sandboxHosted.keys),
    TARE_BAZANTIC_CLIENT_ID: sandboxHosted.bazanticSandbox.clientId,
    TARE_BAZANTIC_SESSION_SECRET: sandboxHosted.bazanticSandbox.sessionSecret,
    TARE_BAZANTIC_GATEWAY_URL: sandboxHosted.bazanticSandbox.gatewayUrl,
    TARE_BAZANTIC_SESSION_MINUTES: '1',
  });
  assert.equal(parsed?.bazanticSandbox?.gatewayUrl, sandboxHosted.bazanticSandbox.gatewayUrl);
  assert.equal(accessFromEnv({
    TARE_PUBLIC_ORIGIN: sandboxHosted.origin,
    TARE_API_KEYS: JSON.stringify(sandboxHosted.keys),
    TARE_BAZANTIC_GATEWAY_URL: sandboxHosted.bazanticSandbox.gatewayUrl,
    TARE_BAZANTIC_SESSION_MINUTES: '15',
  })?.bazanticSandbox, undefined);
  assert.throws(() => accessFromEnv({
    TARE_PUBLIC_ORIGIN: sandboxHosted.origin,
    TARE_API_KEYS: JSON.stringify(sandboxHosted.keys),
    TARE_BAZANTIC_CLIENT_ID: sandboxHosted.bazanticSandbox.clientId,
  }));
});
