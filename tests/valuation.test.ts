import test from 'node:test';
import assert from 'node:assert/strict';
import { readUsdcPrice, valueUsdc, PRICE_SELECTORS } from '../packages/sources/src/chainlink.js';
import type { ContractReader } from '../packages/sources/src/evm.js';
import { word } from '../packages/sources/src/evm.js';
import { evaluateClaimMultiple } from '../packages/verification/src/metric.js';

function priceReader(round: bigint[], decimals = 8n): ContractReader {
  return {
    block: { number: '0x1', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x20000' },
    async call(_to, data) { return `0x${(data === PRICE_SELECTORS.decimals ? [decimals] : round).map(word).join('')}`; },
  };
}
test('timestamped USDC valuation retains exact USD precision and rounding', async () => {
  const price = await readUsdcPrice(priceReader([1n, 99999999n, 131070n, 131071n, 1n]));
  assert.deepEqual(valueUsdc('1000001', price), { valueRaw: '100000098', roundingNumerator: '999999' });
  assert.equal(price.blockTimestamp, '131072');
  assert.equal(price.currency, 'USD');
});
test('prices reject negative, zero, stale, future, incomplete and mis-scaled rounds', async () => {
  const valid = [1n, 100000000n, 131070n, 131071n, 1n];
  for (const [index, value] of [[1, 0n], [1, 2n ** 256n - 1n], [3, 131073n], [4, 0n], [0, 2n ** 80n]] as const) {
    const round = [...valid];
    round[index] = value;
    await assert.rejects(readUsdcPrice(priceReader(round)), /Invalid, future or stale/);
  }
  await assert.rejects(readUsdcPrice(priceReader([1n, 100n, 1n, 1n, 1n])), /stale/);
  await assert.rejects(readUsdcPrice(priceReader(valid, 18n)), /Invalid/);
});
const control = () => ({
  scope: 'local-control' as const, complete: true, debt: 'zero-verified' as const,
  valuation: 'fresh-common-usd' as const,
  claims: [{ id: 'custody-layer', usdRaw: '10000000000' }],
  backing: [{ id: 'cash-location', usdRaw: '10000000000', treatment: 'cash-custody' as const, verification: 'matched' as const }],
});
test('the documented single-layer control gives 1x; three claims on shared backing give 3x', () => {
  const input = control();
  const single = evaluateClaimMultiple(input);
  assert.equal(single.kind, 'control-result');
  if (single.kind === 'control-result') assert.equal(single.multipleMillionths, '1000000');
  input.claims.push({ id: 'second-layer', usdRaw: '10000000000' }, { id: 'third-layer', usdRaw: '10000000000' });
  input.backing.push({ ...input.backing[0]! });
  const layered = evaluateClaimMultiple(input);
  if (layered.kind !== 'control-result') assert.fail('Expected local control arithmetic');
  assert.equal(layered.multipleMillionths, '3000000');
  assert.equal(layered.denominatorRaw, '10000000000');
});
test('partial, indebted, mispriced, conflicting and live-unapproved controls stay unavailable', () => {
  assert.equal(evaluateClaimMultiple({ ...control(), complete: false }).kind, 'unavailable');
  assert.equal(evaluateClaimMultiple({ ...control(), debt: 'positive' }).kind, 'unavailable');
  assert.equal(evaluateClaimMultiple({ ...control(), valuation: 'unavailable' }).kind, 'unavailable');
  assert.equal(evaluateClaimMultiple({ ...control(), scope: 'live' }).kind, 'unavailable');
  const conflicting = control();
  conflicting.backing.push({ ...conflicting.backing[0]!, usdRaw: '1' });
  assert.equal(evaluateClaimMultiple(conflicting).kind, 'unavailable');
  assert.equal(evaluateClaimMultiple({ ...control(), backing: [{ ...control().backing[0]!, treatment: 'lending-receivable' }] }).kind, 'unavailable');
});
