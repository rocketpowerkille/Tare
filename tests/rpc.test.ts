import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { getNativeBalance, NativeBalanceSchema } from '../packages/sources/src/rpc.js';

const address = `0x${'11'.repeat(20)}`;
const blockHash = `0x${'ab'.repeat(32)}`;
const expectedBalance = 201000000000000000n;

test('reads a block-pinned native balance and verifies the RPC chain', async () => {
  const methods: string[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const call = JSON.parse(body) as { id: number; method: string; params: unknown[] };
      methods.push(call.method);
      const result = call.method === 'eth_chainId' ? '0x14a34'
        : call.method === 'eth_getBalance' ? `0x${expectedBalance.toString(16)}`
          : { number: '0x123', hash: blockHash };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const info = server.address() as AddressInfo;
    const result = await getNativeBalance(
      `http://127.0.0.1:${info.port}`,
      { address, chainId: 84532 },
      { symbol: 'ETH', decimals: 18 },
    );
    assert.equal(NativeBalanceSchema.parse(result).balance, '0.201');
    assert.equal(result.balanceRaw, expectedBalance.toString());
    assert.equal(result.block.number, '291');
    assert.deepEqual(methods, ['eth_chainId', 'eth_getBlockByNumber', 'eth_getBalance', 'eth_getBlockByNumber']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('rejects an RPC endpoint for a different chain before reading a balance', async () => {
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const call = JSON.parse(body) as { id: number };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: call.id, result: '0x1' }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const info = server.address() as AddressInfo;
    await assert.rejects(
      getNativeBalance(`http://127.0.0.1:${info.port}`, { address, chainId: 84532 }, { symbol: 'ETH', decimals: 18 }),
      /does not match wallet chain ID 84532/,
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
