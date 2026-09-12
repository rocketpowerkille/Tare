import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { get } from 'node:http';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { TareService, configFromEnv, examples } from '../packages/service/src/index.js';
import { MAX_INPUT_BYTES, ServiceError, publicError } from '../packages/service/src/requests.js';
import { withApi, post } from './helpers/api.js';
import { compositionFixture } from './helpers/composition.js';
import { replayLiveCapture } from '../packages/resolver/src/live.js';
import { replayNestedCapture } from '../packages/resolver/src/nested.js';
import { replayCustody } from '../packages/verification/src/custody.js';
import { readJsonFile } from '../packages/sources/src/snapshot.js';

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
    for (const example of examples) {
      const compactResponse = await post(url, 'agent-example', { id: example.id });
      const compactText = await compactResponse.text();
      const compact = JSON.parse(compactText) as Record<string, unknown>;
      assert.equal(compactResponse.status, 200);
      assert.ok(Buffer.byteLength(compactText) < 4 * 1024);
      assert.equal(compact.sourceMode, 'recorded-rpc');
      assert.equal(compact.captureOmitted, true);
      assert.ok(!('capture' in compact));
      if (example.id === 'steakhouse-usdc') assert.equal((compact.markets as { count: number }).count, 12);
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
    const health = await fetch(`${url}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const status = await fetch(`${url}/api/status`);
    const text = await status.text();
    assert.ok(!text.includes('SECRET'));
    assert.equal(JSON.parse(text).live['resolve-v1'], true);
    assert.equal(JSON.parse(text).live['verify-shares'], false);
    const schema = await (await fetch(`${url}/openapi.json`)).json() as {
      openapi: string;
      paths: Record<string, { post?: { requestBody?: { content?: Record<string, { schema?: unknown }> } } }>;
    };
    assert.equal(schema.openapi, '3.0.3');
    assert.deepEqual(Object.keys(schema.paths).sort(), ['/api/agent-analyze', '/api/agent-example', '/api/analyze', '/api/compose', '/api/example', '/api/replay', '/api/status', '/healthz']);
    for (const route of Object.values(schema.paths)) {
      const requestSchema = route.post?.requestBody?.content?.['application/json']?.schema as { type?: string } | undefined;
      if (requestSchema) assert.equal(requestSchema.type, 'object');
    }
    assert.ok(!JSON.stringify(schema).includes('"$schema"'));
    assert.ok(!JSON.stringify(schema).includes('"const"'));
    const mcpSchema = await (await fetch(`${url}/openapi-mcp.json`)).json() as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    assert.equal(mcpSchema.openapi, '3.0.0');
    assert.deepEqual(Object.keys(mcpSchema.paths).sort(), ['/api/agent-analyze', '/api/agent-example', '/api/status']);
    assert.ok(!JSON.stringify(mcpSchema).includes('additionalProperties":true'));
    assert.deepEqual(await (await fetch(`${url}/openapi-mcp-v2.json`)).json(), mcpSchema);
    assert.deepEqual(await (await fetch(`${url}/openapi-mcp-v3.json`)).json(), mcpSchema);
    const graphSchema = await (await fetch(`${url}/openapi-graph.json`)).json() as {
      servers: { url: string }[]; paths: Record<string, { post: { operationId: string } }>;
    };
    assert.deepEqual(graphSchema.servers, [{ url: 'https://api.studio.thegraph.com' }]);
    assert.equal(graphSchema.paths['/query/1760123/tare-live-accounting/0.1.0']?.post.operationId,
      'graph_tare_accounting_head');
    for (const [path, type] of [['/', 'text/html'], ['/explore', 'text/html'], ['/docs', 'text/html'], ['/developers', 'text/html'], ['/assets/app.js', 'text/javascript'], ['/assets/app.css', 'text/css'], ['/favicon.svg', 'image/svg+xml']]) {
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
    assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ['tare_analyze', 'tare_compose', 'tare_example', 'tare_replay', 'tare_status']);
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
    const combined = await compositionFixture();
    const composed = await client.callTool({ name: 'tare_compose', arguments: combined });
    assert.deepEqual(composed.structuredContent, await service.run('compose', combined));
    await withApi(async url => {
      const response = await post(url, 'compose', combined);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), composed.structuredContent);
    });
  } finally { await client.close(); }
});
