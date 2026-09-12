import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { withServer, json } from './helpers/http.js';
import { resolveErc4626Position, replayErc4626Capture } from '../packages/resolver/src/erc4626.js';
import { SELECTOR } from '../packages/adapters/src/morpho-blue.js';
import { word } from '../packages/sources/src/evm.js';

const RpcRequest = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) });
const abiBytes32 = (value: string) => `0x${Buffer.from(value).toString('hex').padEnd(64, '0')}`;

test('generic ERC-4626 check confirms wallet shares and underlying amount at one block', async () => {
  const owner = `0x${'11'.repeat(20)}`;
  const vault = `0x${'22'.repeat(20)}`;
  const asset = `0x${'33'.repeat(20)}`;
  const block = { number: '0x123', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x456' };
  await withServer((body, response) => {
    const call = RpcRequest.parse(body);
    if (call.method === 'eth_chainId') return json(response, { jsonrpc: '2.0', id: call.id, result: '0x1' });
    if (call.method === 'eth_getBlockByNumber') return json(response, { jsonrpc: '2.0', id: call.id, result: block });
    if (call.method === 'eth_getCode') return json(response, { jsonrpc: '2.0', id: call.id, result: '0x6000' });
    const transaction = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]);
    const values: Record<string, string> = {
      [`${vault}:${SELECTOR.asset}`]: `0x${word(asset)}`,
      [`${vault}:${SELECTOR.balance}${word(owner)}`]: `0x${word(100n)}`,
      [`${vault}:${SELECTOR.convert}${word(100n)}`]: `0x${word(250n)}`,
      [`${vault}:${SELECTOR.supply}`]: `0x${word(1000n)}`,
      [`${vault}:${SELECTOR.assets}`]: `0x${word(2500n)}`,
      [`${asset}:${SELECTOR.decimals}`]: `0x${word(18n)}`,
      [`${vault}:0x06fdde03`]: abiBytes32('Generic Vault'),
      [`${asset}:0x95d89b41`]: abiBytes32('WETH'),
    };
    return json(response, { jsonrpc: '2.0', id: call.id, result: values[`${transaction.to}:${transaction.data}`] });
  }, async rpcUrl => {
    const report = await resolveErc4626Position({ owner, vault, chainId: 1, rpcUrl });
    assert.equal(report.kind, 'complete');
    assert.equal(report.position?.assetsRaw, '250');
    assert.equal(report.position?.assetSymbol, 'WETH');
    const replay = await replayErc4626Capture(report.capture);
    assert.equal(replay.position?.assetsRaw, '250');
    assert.equal(replay.sourceMode, 'recorded-rpc');
  });
});
