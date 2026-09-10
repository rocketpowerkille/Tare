import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { get } from 'node:http';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { TareService, configFromEnv, examples } from '../packages/service/src/index.js';
import { MAX_INPUT_BYTES, ServiceError, publicError } from '../packages/service/src/requests.js';
import { createApiServer } from '../apps/api/src/server.js';
import { replayLiveCapture } from '../packages/resolver/src/live.js';
import { replayNestedCapture } from '../packages/resolver/src/nested.js';
import { replayCustody } from '../packages/verification/src/custody.js';
import { readJsonFile } from '../packages/sources/src/snapshot.js';

async function withApi(run: (url: string) => Promise<void>, service = new TareService()) {
  const server = createApiServer(service);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function post(url: string, action: string, input: unknown, headers: Record<string, string> = {}) {
  return fetch(`${url}/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(input) });
}

test('API examples and uploaded captures preserve the exact resolver reports and scoped metrics', async () => {
  const replays = [replayLiveCapture, replayNestedCapture, replayCustody];
  await withApi(async url => {
    for (const [index, example] of examples.entries()) {
      const capture = await readJsonFile(`fixtures/live/${example.id}.capture.json`);
      const expected = await replays[index]!(capture);
      const response = await post(url, 'example', { id: example.id });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected);
      const replay = await post(url, 'replay', { operation: example.operation, capture });
      assert.deepEqual(await replay.json(), expected);
    }
    const capture = await readJsonFile('fixtures/live/ov-usdc-v2.capture.json') as { rpc: { confirmed: boolean } };
    capture.rpc.confirmed = false;
    const response = await post(url, 'replay', { operation: 'resolve-v2', capture });
    const report = await response.json() as { status: string; metric: { kind: string }; analysis: unknown };
    assert.equal(response.status, 200);
    assert.equal(report.status, 'partial');
    assert.equal(report.metric.kind, 'unavailable');
    assert.equal(report.analysis, null);
  });
});

test('API rejects cross-origin requests, URLs, paths, invalid bodies and unsupported operations', async () => {
  await withApi(async url => {
    const address = `0x${'1'.repeat(40)}`;
    const input = { operation: 'resolve-v1', owner: address, vault: address };
    assert.equal((await post(url, 'analyze', input)).status, 503);
    for (const extra of [{ rpcUrl: 'http://private.invalid/SECRET' }, { chainId: 8453 }, { privateKey: 'SECRET' }]) {
      const response = await post(url, 'analyze', { ...input, ...extra });
      assert.equal(response.status, 400);
      assert.ok(!(await response.text()).includes('SECRET'));
    }
    assert.equal((await post(url, 'example', { id: '../../.env' })).status, 400);
    assert.equal((await post(url, 'replay', { operation: 'resolve-v1', capture: {} })).status, 400);
    assert.equal((await post(url, 'example', { id: 'steakhouse-usdc' }, { origin: 'https://evil.invalid' })).status, 403);
    // Fetch can overwrite reserved headers; exercise the server with actual HTTP headers.
    for (const headers of [{ host: 'evil.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        get(`${url}/api/status`, { headers }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
      });
      assert.equal(status, 403);
    }
    assert.equal((await post(url, 'example', {}, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await fetch(`${url}/api/example`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await post(url, 'example', { padding: 'x'.repeat(MAX_INPUT_BYTES) })).status, 413);
    assert.equal((await fetch(`${url}/api/example`)).status, 405);
    assert.equal((await fetch(`${url}/.env`)).status, 404);
    assert.equal((await post(url, 'unknown', {})).status, 404);
    assert.equal((await post(url, 'example', { id: 'weth-custody' }, { origin: url })).status, 200);
  });
});

test('configuration stays private, OpenAPI describes strict requests, and explorer assets are served', async () => {
  const service = new TareService(configFromEnv({ TARE_RPC_URL: 'https://rpc.invalid/SECRET', GRAPH_API_KEY: 'SECRET' }));
  await withApi(async url => {
    const status = await fetch(`${url}/api/status`);
    const text = await status.text();
    assert.ok(!text.includes('SECRET'));
    assert.equal(JSON.parse(text).live['resolve-v1'], true);
    assert.equal(JSON.parse(text).live['verify-shares'], false);
    const schema = await (await fetch(`${url}/openapi.json`)).json() as { paths: Record<string, unknown> };
    assert.deepEqual(Object.keys(schema.paths).sort(), ['/api/analyze', '/api/example', '/api/replay', '/api/status']);
    for (const [path, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/style.css', 'text/css']]) {
      const response = await fetch(`${url}${path}`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.startsWith(type!));
      assert.match(response.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
    }
  }, service);
  assert.ok(!publicError(new Error('SECRET')).message.includes('SECRET'));
});

test('shared operation limit rejects excess work and releases slots after success or failure', async () => {
  const service = new TareService();
  const first = service.run('example', { id: 'steakhouse-usdc' });
  const second = service.run('example', { id: 'ov-usdc-v2' });
  await assert.rejects(service.run('example', { id: 'weth-custody' }), (error: unknown) => error instanceof ServiceError && error.status === 429);
  await Promise.all([first, second]);
  await assert.rejects(service.run('example', { id: 'invalid' }));
  await service.run('example', { id: 'weth-custody' });
});

test('real MCP stdio client discovers tools, replays evidence and returns actionable errors from any cwd', { timeout: 30000 }, async () => {
  const client = new Client({ name: 'tare-acceptance', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../apps/mcp/src/main.js', import.meta.url))], cwd: tmpdir(), stderr: 'pipe' });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ['tare_analyze', 'tare_example', 'tare_replay', 'tare_status']);
    assert.ok(listed.tools.every(tool => tool.annotations?.readOnlyHint === true));
    const service = new TareService();
    for (const example of examples) {
      const result = await client.callTool({ name: 'tare_example', arguments: { id: example.id } });
      assert.ok(!result.isError);
      assert.deepEqual(result.structuredContent, await service.run('example', { id: example.id }));
    }
    const invalid = await client.callTool({ name: 'tare_example', arguments: { id: '../../.env' } });
    assert.equal(invalid.isError, true);
    const capture = await readJsonFile('fixtures/live/ov-usdc-v2.capture.json');
    const replay = await client.callTool({ name: 'tare_replay', arguments: { operation: 'resolve-v2', capture } });
    assert.deepEqual(replay.structuredContent, await service.run('example', { id: 'ov-usdc-v2' }));
    const address = `0x${'1'.repeat(40)}`;
    const missing = await client.callTool({ name: 'tare_analyze', arguments: { operation: 'resolve-v2', owner: address, vault: address } });
    assert.equal(missing.isError, true);
    assert.match(JSON.stringify(missing.content), /not-configured/);
  } finally { await client.close(); }
});
