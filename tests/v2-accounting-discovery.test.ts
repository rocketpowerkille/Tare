import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { TareService } from '../packages/service/src/index.js';
import type { discoverPositions } from '../packages/service/src/discovery.js';
import { withServer, json } from './helpers/http.js';

const owner = `0x${'1'.repeat(40)}`;
const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

test('V2 discovery offers explicit accounting fallback while preserving nested USDC and V1 routes', async () => {
  await withServer((body, response) => {
    const { variables: { chain } } = z.object({ variables: z.object({ chain: z.number() }) }).parse(body);
    const vault = (address: string, asset: string) => ({ address, name: 'Discovery fixture',
      chain: { id: chain }, asset: { address: asset, symbol: 'TEST', decimals: 18 } });
    json(response, { data: { userByAddress: {
      vaultPositions: [{ vault: vault(`0x${'2'.repeat(40)}`, weth), state: { shares: '1', assets: '1' } }],
      vaultV2Positions: [weth, usdc].map((asset, index) => ({
        vault: vault(`0x${String(index + 3).repeat(40)}`, asset), shares: '1', assets: '1',
      })),
    } } });
  }, async url => {
    // Symbols are deliberately unrelated: operation selection uses exact identity, not labels.
    const service = new TareService({ morphoUrl: url, rpcUrl: url, baseMainnetRpcUrl: url, arbitrumRpcUrl: url });
    const result = await service.run('discover', { owner }) as Awaited<ReturnType<typeof discoverPositions>>;
    assert.equal(result.positions.length, 9);
    for (const position of result.positions) {
      assert.equal(position.support.status, 'supported');
      if (position.support.status !== 'supported') throw new Error('Expected configured route');
      const nested = position.version === 'v2' && position.chainId === 1 && position.asset.address === usdc;
      assert.equal(position.support.operation, position.version === 'v1' ? 'resolve-v1' : nested ? 'resolve-v2' : 'resolve-erc4626');
      if (position.support.operation === 'resolve-erc4626') assert.match(position.support.checkType, /Accounting only.*not traced/);
    }
    const unavailable = await new TareService({ morphoUrl: url }).run('discover', { owner }) as typeof result;
    assert.ok(unavailable.positions.every(position => position.support.status === 'unsupported'));
    assert.ok(unavailable.positions.every(position => position.support.status === 'unsupported' && /RPC is not configured/.test(position.support.reason)));
  });
});
