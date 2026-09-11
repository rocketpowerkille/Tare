import { ERC4626_SELECTOR } from '../../packages/adapters/src/erc4626-custody.js';
import { word } from '../../packages/sources/src/evm.js';
import { evidenceDigest } from '../../packages/sources/src/recorded.js';

export const baseOwner = `0x${'11'.repeat(20)}`;
export const baseOuterVault = `0x${'22'.repeat(20)}`;
export const baseInnerVault = `0x${'33'.repeat(20)}`;
export const baseTerminalAsset = `0x${'44'.repeat(20)}`;
export const baseBlock = { number: '0x63', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x3e8' };
const observedAt = '2026-09-11T00:00:00.000Z';

function encoded(value: bigint | string) { return `0x${word(value)}`; }

export function baseSepoliaCapture() {
  const calls = [
    [baseOuterVault, ERC4626_SELECTOR.asset, encoded(baseInnerVault)],
    [baseOuterVault, ERC4626_SELECTOR.balanceOf + word(baseOwner), encoded(100n)],
    [baseOuterVault, ERC4626_SELECTOR.totalSupply, encoded(100n)],
    [baseOuterVault, ERC4626_SELECTOR.totalAssets, encoded(100n)],
    [baseInnerVault, ERC4626_SELECTOR.balanceOf + word(baseOuterVault), encoded(100n)],
    [baseOuterVault, ERC4626_SELECTOR.previewRedeem + word(100n), encoded(100n)],
    [baseInnerVault, ERC4626_SELECTOR.asset, encoded(baseTerminalAsset)],
    [baseInnerVault, ERC4626_SELECTOR.totalSupply, encoded(100n)],
    [baseInnerVault, ERC4626_SELECTOR.totalAssets, encoded(100n)],
    [baseTerminalAsset, ERC4626_SELECTOR.balanceOf + word(baseInnerVault), encoded(100n)],
    [baseInnerVault, ERC4626_SELECTOR.previewRedeem + word(100n), encoded(100n)],
  ].map(([to, data, result], index) => ({
    id: `rpc-${index + 1}`, to, data, result, blockHash: baseBlock.hash, observedAt,
  }));
  const code = [
    { address: baseOuterVault, code: '0x6001', blockHash: baseBlock.hash, observedAt },
    { address: baseInnerVault, code: '0x6002', blockHash: baseBlock.hash, observedAt },
    { address: baseTerminalAsset, code: '0x6003', blockHash: baseBlock.hash, observedAt },
  ];
  const witness = (providerId: string) => ({
    providerId,
    rpc: { block: baseBlock, confirmed: true, calls: structuredClone(calls), failedCalls: [] },
    codes: structuredClone(code),
  });
  return {
    captureVersion: 1 as const,
    scope: 'base-sepolia-two-layer-erc4626-custody' as const,
    chainId: 84532 as const,
    owner: baseOwner,
    deployment: {
      outerVault: baseOuterVault,
      innerVault: baseInnerVault,
      terminalAsset: baseTerminalAsset,
      codeDigests: {
        outerVault: evidenceDigest('0x6001'),
        innerVault: evidenceDigest('0x6002'),
        terminalAsset: evidenceDigest('0x6003'),
      },
    },
    capturedAt: observedAt,
    witnesses: [witness(evidenceDigest('provider-a')), witness(evidenceDigest('provider-b'))] as const,
    failures: [],
  };
}
