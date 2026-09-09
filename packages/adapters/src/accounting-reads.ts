import { ETHEREUM_USDC, MORPHO_BLUE_ETHEREUM, readUint, SELECTOR } from './morpho-blue.js';
import { decodeAddress, decodeWords, word } from '../../sources/src/evm.js';
import type { ContractReader } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';

/** Exact, bounded read set shared by acquisition and offline comparison. */
export async function readAccounting(reader: ContractReader, vault: string) {
  const reads: { to: string; data: string; result: string }[] = [];
  const recording: ContractReader = {
    block: reader.block,
    async call(to, data) {
      const result = await reader.call(to, data);
      reads.push({ to, data, result });
      return result;
    },
  };
  const morpho = decodeAddress(await recording.call(vault, SELECTOR.morpho));
  const asset = decodeAddress(await recording.call(vault, SELECTOR.asset));
  if (morpho !== MORPHO_BLUE_ETHEREUM || asset !== ETHEREUM_USDC) {
    throw new SourceFailure('invalid-response', 'Unsupported accounting deployment or asset');
  }
  for (const selector of [SELECTOR.supply, SELECTOR.assets, SELECTOR.fee, SELECTOR.lastAssets, SELECTOR.offset]) {
    await readUint(recording, vault, selector);
  }
  const length = await readUint(recording, vault, SELECTOR.queueLength);
  if (length > 64n) throw new SourceFailure('budget', 'Accounting queue exceeds 64 markets');
  const seen = new Set<string>();
  for (let index = 0n; index < length; index++) {
    const market = await recording.call(vault, SELECTOR.queue + word(index));
    decodeWords(market, 1);
    if (seen.has(market)) throw new SourceFailure('invalid-response', 'Duplicate accounting market');
    seen.add(market);
    for (const [data, count] of [
      [SELECTOR.params + market.slice(2), 5], [SELECTOR.market + market.slice(2), 6],
      [SELECTOR.position + market.slice(2) + word(vault), 3],
    ] as const) decodeWords(await recording.call(morpho, data), count);
  }
  return reads;
}
