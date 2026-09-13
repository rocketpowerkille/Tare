import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicRecipeExecutor, parseMcp } from '../apps/api/src/recipe-client.js';

const gateway = 'https://test123.bazgateway.com/recipe-mcp';
function fakeFetch(options: { gateway?: string; status?: number; result?: unknown; redirect?: boolean } = {}) {
  const calls: { url: string; method: string }[] = [];
  const send: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('authorization'), null);
    calls.push({ url: String(url), method: body.method });
    const result = body.method === 'initialize' ? { _meta: { 'com.bazantic/recipe': { gateway_mcp_url: options.gateway ?? gateway } } }
      : body.method === 'tools/list' ? { tools: [{ name: 'test', inputSchema: { type: 'object', required: ['question'], properties: { question: { type: 'string', maxLength: 4000 } } } }] }
      : options.result ?? { structuredContent: { output: 'An answer' }, isError: false };
    return new Response(JSON.stringify({ id: 1, result }), { status: body.method === 'tools/call' ? options.status ?? 200 : 200 });
  };
  return { send, calls };
}

test('Recipe discovers gateway every execution and sends no payment or user credentials', async () => {
  const fake = fakeFetch();
  const runner = new PublicRecipeExecutor(fake.send);
  assert.equal((await runner.execute('test', 'Explain')).output, 'An answer');
  await runner.execute('test', 'Explain again');
  assert.equal(fake.calls.filter(call => call.method === 'initialize').length, 2);
});
test('Recipe 402 does not retry or report settlement', async () => {
  const fake = fakeFetch({ status: 402 });
  await assert.rejects(new PublicRecipeExecutor(fake.send).execute('test', 'Explain'), /No payment was authorized/);
  assert.equal(fake.calls.filter(call => call.method === 'tools/call').length, 1);
});
test('Recipe rejects SSRF, credential URLs, redirects and unrelated execution paths', async () => {
  for (const url of ['http://127.0.0.1/recipe-mcp', 'https://evil.test/recipe-mcp', 'https://x.bazgateway.com.evil.test/recipe-mcp', 'https://user:secret@test.bazgateway.com/recipe-mcp', 'https://test.bazgateway.com/other', 'https://test.bazgateway.com:444/recipe-mcp']) {
    const fake = fakeFetch({ gateway: url });
    await assert.rejects(new PublicRecipeExecutor(fake.send).execute('test', 'Explain'), /unavailable/);
    assert.equal(fake.calls.length, 1);
  }
  await assert.rejects(new PublicRecipeExecutor(fakeFetch({ status: 302 }).send).execute('test', 'Explain'), /could not complete/);
});
test('MCP parser handles JSON and multiline SSE without accepting unrelated events', () => {
  assert.deepEqual(parseMcp('event: message\ndata: {"id":1,\ndata: "result":{"ok":true}}\n\n').result, { ok: true });
  assert.throws(() => parseMcp('data: {"id":2,"result":{}}\n\n'));
  assert.throws(() => parseMcp('{"id":2,"result":{}}'));
});
test('tool errors and unavailable catalog do not become successful answers', async () => {
  await assert.rejects(new PublicRecipeExecutor(fakeFetch({ result: { isError: true } }).send).execute('test', 'Explain'), /unavailable/);
  await assert.rejects(new PublicRecipeExecutor(fakeFetch().send).execute('missing', 'Explain'), /not present/);
});
