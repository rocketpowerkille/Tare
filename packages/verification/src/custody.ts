import { z } from 'zod/v4';
import { AddressSchema } from '../../domain/src/index.js';
import { UintSchema } from '../../domain/src/live.js';
import { readUint, SELECTOR } from '../../adapters/src/morpho-blue.js';
import { PinnedRpc, settleReads, word } from '../../sources/src/evm.js';
import type { ContractReader } from '../../sources/src/evm.js';
import { readEthPrice } from '../../sources/src/chainlink.js';
import { evidenceDigest, RecordedReader } from '../../sources/src/recorded.js';
import { SourceFailure, validateHttpUrl } from '../../sources/src/http.js';
import { CustodyCaptureSchema } from './custody-capture.js';
import type { CustodyCapture } from './custody-capture.js';

export const ETHEREUM_WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
async function readClaim(reader: ContractReader, owner: string) {
  const [balance, supply, decimals] = await settleReads([
    readUint(reader, ETHEREUM_WETH, SELECTOR.balance, word(owner)),
    readUint(reader, ETHEREUM_WETH, SELECTOR.supply), readUint(reader, ETHEREUM_WETH, SELECTOR.decimals),
  ]);
  if (decimals !== 18n || balance! > supply!) throw new SourceFailure('invalid-response', 'Invalid WETH accounting');
  const price = await readEthPrice(reader);
  return { balanceRaw: balance!.toString(), supplyRaw: supply!.toString(), price };
}

export async function replayCustody(input: unknown, sourceMode: 'live-rpc' | 'recorded-rpc' = 'recorded-rpc') {
  const capture = CustodyCaptureSchema.parse(input);
  const findings = [...capture.failures];
  const [first, second] = capture.witnesses;
  if (first.providerId === second.providerId) findings.push('same-provider');
  if (!first.rpc.confirmed || !second.rpc.confirmed || !first.rpc.block || !second.rpc.block) findings.push('unconfirmed-block');
  if (JSON.stringify(first.rpc.block) !== JSON.stringify(second.rpc.block)) findings.push('block-mismatch');
  const claims: Awaited<ReturnType<typeof readClaim>>[] = [];
  if (!findings.length) {
    for (const witness of capture.witnesses) {
      try {
        const claim = await readClaim(new RecordedReader(witness.rpc), capture.owner);
        const native = witness.balances[0];
        if (!native || native.address !== ETHEREUM_WETH || BigInt(native.balance) !== BigInt(claim.supplyRaw)) {
          findings.push('native-custody-mismatch');
        }
        claims.push(claim);
      } catch (error) {
        if (!(error instanceof SourceFailure)) throw error;
        findings.push(error.code);
      }
    }
    if (claims.length !== 2 || JSON.stringify(claims[0]) !== JSON.stringify(claims[1])) findings.push('provider-disagreement');
    if (claims[0]?.balanceRaw === '0') findings.push('zero-position');
  }
  const claim = findings.length ? null : claims[0]!;
  const usd = claim ? BigInt(claim.balanceRaw) * BigInt(claim.price.answerRaw) / (10n ** 18n) : null;
  if (usd === 0n) findings.push('valuation-rounds-to-zero');
  return {
    reportType: 'weth-custody' as const, schemaVersion: 1, sourceMode,
    status: findings.length ? 'incomplete' as const : 'matched' as const,
    captureDigest: evidenceDigest(capture), capture, findings, claim,
    verification: 'two-provider-native-custody-cross-check' as const,
    metric: !findings.length && usd !== null
      ? { kind: 'available' as const, scope: 'weth-wrapper-only' as const, currency: 'USD' as const,
        decimals: 8, numeratorRaw: usd.toString(), denominatorRaw: usd.toString(), multipleMillionths: '1000000' }
      : { kind: 'unavailable' as const, reasons: findings },
    limitations: ['provider-independence-not-proven', 'unsigned-recording', 'holder-other-liabilities-outside-scope'],
  };
}

const OptionsSchema = z.strictObject({
  owner: AddressSchema, rpcUrl: z.string().min(1), secondaryRpcUrl: z.string().min(1),
  blockNumber: UintSchema.optional(), timeoutMs: z.number().int().min(100).max(60000).default(10000),
});
export async function verifyWethCustody(input: z.input<typeof OptionsSchema>) {
  const options = OptionsSchema.parse(input);
  const urls = [options.rpcUrl, options.secondaryRpcUrl].map(validateHttpUrl);
  // Reject the same hostname even when paths or API keys differ. IDs retain no URL credentials.
  const ids = urls.map(url => evidenceDigest(new URL(url).hostname));
  if (ids[0] === ids[1]) throw new Error('Custody verification requires different RPC hostnames');
  const readers = urls.map(url => new PinnedRpc(url, options.timeoutMs, 9, 120000)) as [PinnedRpc, PinnedRpc];
  const capture: CustodyCapture = {
    captureVersion: 1, scope: 'ethereum-weth-native-custody', chainId: 1,
    owner: options.owner, capturedAt: new Date().toISOString(), failures: [],
    witnesses: readers.map((reader, index) => ({ providerId: ids[index]!, balances: reader.nativeBalances,
      rpc: { block: null, confirmed: false, calls: reader.observations, failedCalls: reader.failedCalls } })) as CustodyCapture['witnesses'],
  };
  try {
    await readers[0].pin(1, options.blockNumber);
    await readers[1].pin(1, BigInt(readers[0].block.number).toString());
    const results = await Promise.allSettled(readers.map(async (reader, index) => {
      const witness = capture.witnesses[index]!;
      witness.rpc.block = reader.block;
      await readClaim(reader, options.owner);
      await reader.nativeBalance(ETHEREUM_WETH);
      await reader.confirm();
      witness.rpc.confirmed = true;
    }));
    for (const result of results) if (result.status === 'rejected') {
      if (!(result.reason instanceof SourceFailure)) throw result.reason;
      capture.failures.push(result.reason.code);
    }
  } catch (error) {
    if (!(error instanceof SourceFailure)) throw error;
    capture.failures.push(error.code);
  }
  return replayCustody(capture, 'live-rpc');
}
