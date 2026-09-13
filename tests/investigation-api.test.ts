import assert from 'node:assert/strict';
import test from 'node:test';
import { request } from 'node:http';
import { withApi } from './helpers/api.js';
import { randomUUID } from 'node:crypto';

const hosted = { origin: 'https://tare.test', keys: { member: 'm'.repeat(40), bazantic: 'g'.repeat(40), other: 'o'.repeat(40) },
  bazanticSandbox: { clientId: 'bazantic', sessionSecret: 's'.repeat(40), gatewayUrl: 'https://tare.bazgateway.com' } };
function send(url: string, path: string, key?: string, input?: unknown, host = 'tare.test') {
  return new Promise<{ status: number; data: Record<string, unknown> }>((resolve, reject) => {
    const req = request(url + path, { method: input === undefined ? 'GET' : 'POST', headers: { host, ...(key ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json' } }, response => {
      let body = ''; response.on('data', data => { body += String(data); });
      response.on('end', () => resolve({ status: response.statusCode!, data: JSON.parse(body) }));
    }); req.on('error', reject); req.end(input === undefined ? undefined : JSON.stringify(input));
  });
}

test('new routes retain auth, origin, reference isolation and gateway-only context access', async () => {
  await withApi(async url => {
    for (const path of ['/api/investigation/options', '/api/investigation/snapshot', '/api/investigation/run', '/api/agent-report-context', '/api/agent-compare-accounting', '/api/investigation/wallet']) {
      assert.equal((await send(url, path)).status, 401);
      assert.equal((await send(url, path, hosted.keys.member, {}, 'evil.test')).status, 403);
    }
    assert.equal((await send(url, '/api/investigation/options', hosted.keys.member)).data.enabled, false);
    const report = await send(url, '/api/example', hosted.keys.member, { id: 'steakhouse-usdc' });
    const snapshot = await send(url, '/api/investigation/snapshot', hosted.keys.member, { report: report.data });
    assert.equal(snapshot.status, 200);
    const reference = snapshot.data.reference;
    assert.equal((await send(url, '/api/agent-report-context', hosted.keys.member, { reference })).status, 403);
    const context = await send(url, '/api/agent-report-context', hosted.keys.bazantic, { reference });
    assert.equal(context.status, 200);
    assert.ok(Array.isArray(context.data.facts));
    assert.doesNotMatch(JSON.stringify(context.data), /tare_sandbox_v1|sessionSecret/);
    assert.equal((await send(url, '/api/investigation/snapshot', hosted.keys.member, { report: { accessToken: 'hidden' } })).status, 400);
    assert.equal((await send(url, '/api/investigation/run', hosted.keys.member, { reference, requestId: randomUUID(), question: 'Explain', consent: true })).status, 503);
    assert.equal((await send(url, '/api/investigation/wallet', hosted.keys.member, { owner: 'bad' })).status, 400);
  }, undefined, hosted);
});

test('invalid and expired sessions cannot create snapshots or execute Recipes', async () => {
  await withApi(async url => {
    for (const key of ['x'.repeat(40), 'tare_sandbox_v1.expired.invalid']) {
      assert.equal((await send(url, '/api/investigation/snapshot', key, { report: {} })).status, 401);
    }
    const issued = await send(url, '/api/bazantic/session', hosted.keys.bazantic, {});
    const session = String(issued.data.accessToken);
    const options = await send(url, '/api/investigation/options', session);
    assert.equal(options.status, 200);
    assert.equal(options.data.maximumAuthorizedSpend, '0');
  }, undefined, hosted);
});
