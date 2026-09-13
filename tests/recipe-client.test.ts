import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicRecipeExecutor, parseMcp } from '../apps/api/src/recipe-client.js';
import { RecipeError } from '../apps/api/src/recipe-errors.js';

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
  await assert.rejects(new PublicRecipeExecutor(fakeFetch({ result: { isError: true } }).send).execute('test', 'Explain'), /tool error/);
  await assert.rejects(new PublicRecipeExecutor(fakeFetch().send).execute('missing', 'Explain'), /not present/);
});

test('Recipe tool diagnostics retain known codes but never upstream prose or secrets', async () => {
  const fake = fakeFetch({ result: { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: {
    code: 'no_tool_calls', message: 'Bearer secret-provider-token', reference: 'private-reference',
  } }) }] } });
  await assert.rejects(new PublicRecipeExecutor(fake.send).execute('test', 'Explain'), error => {
    assert.ok(error instanceof RecipeError);
    assert.deepEqual(error.diagnostic, { stage: 'execution', code: 'recipe-tool-error', upstreamCode: 'no_tool_calls' });
    assert.match(error.message, /did not make a tool call/);
    assert.doesNotMatch(JSON.stringify(error), /secret-provider-token|private-reference/);
    return true;
  });
  assert.equal(fake.calls.filter(call => call.method === 'tools/call').length, 1);
  for (const code of ['Bearer secret', '__proto__', 'toString']) {
    await assert.rejects(new PublicRecipeExecutor(fakeFetch({ result: { isError: true,
      structuredContent: { error: { code } } } }).send).execute('test', 'Explain'), error => {
      assert.ok(error instanceof RecipeError);
      assert.equal(error.diagnostic.upstreamCode, undefined);
      assert.doesNotMatch(error.message, /Bearer secret|__proto__|toString/);
      return true;
    });
  }
});

test('Recipe diagnostics distinguish transport stages and discard MCP error data', async () => {
  for (const method of ['initialize', 'tools/list', 'tools/call']) {
    const fake = fakeFetch();
    const send: typeof fetch = async (url, init) => {
      if (JSON.parse(String(init?.body)).method === method) {
        return new Response(JSON.stringify({ id: 1, error: { code: -32603,
          message: 'secret-reference', data: { token: 'secret-token' } } }));
      }
      return fake.send(url, init);
    };
    await assert.rejects(new PublicRecipeExecutor(send).execute('test', 'Explain'), error => {
      assert.ok(error instanceof RecipeError);
      assert.equal(error.diagnostic.stage, method === 'initialize' ? 'discovery' : method === 'tools/list' ? 'catalog' : 'execution');
      assert.equal(error.diagnostic.rpcCode, -32603);
      assert.doesNotMatch(JSON.stringify(error), /secret-reference|secret-token/);
      return true;
    });
  }
});
