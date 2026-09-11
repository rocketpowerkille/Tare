import test from 'node:test';
import assert from 'node:assert/strict';
import { ERC4626_SELECTOR } from '../packages/adapters/src/erc4626-custody.js';
import { word } from '../packages/sources/src/evm.js';
import { evidenceDigest } from '../packages/sources/src/recorded.js';
import { SepoliaCustodyCaptureSchema } from '../packages/verification/src/sepolia-custody-capture.js';
import { replaySepoliaCustody } from '../packages/verification/src/sepolia-custody.js';

const owner = `0x${'11'.repeat(20)}`;
const outerVault = `0x${'22'.repeat(20)}`;
const innerVault = `0x${'33'.repeat(20)}`;
const terminalAsset = `0x${'44'.repeat(20)}`;
const block = { number: '0x63', hash: `0x${'ab'.repeat(32)}`, timestamp: '0x3e8' };
const observedAt = '2026-09-11T00:00:00.000Z';

function encoded(value: bigint | string) { return `0x${word(value)}`; }

function capture() {
  const calls = [
    [outerVault, ERC4626_SELECTOR.asset, encoded(innerVault)],
    [outerVault, ERC4626_SELECTOR.balanceOf + word(owner), encoded(100n)],
    [outerVault, ERC4626_SELECTOR.totalSupply, encoded(100n)],
    [outerVault, ERC4626_SELECTOR.totalAssets, encoded(100n)],
    [innerVault, ERC4626_SELECTOR.balanceOf + word(outerVault), encoded(100n)],
    [outerVault, ERC4626_SELECTOR.previewRedeem + word(100n), encoded(100n)],
    [innerVault, ERC4626_SELECTOR.asset, encoded(terminalAsset)],
    [innerVault, ERC4626_SELECTOR.totalSupply, encoded(100n)],
    [innerVault, ERC4626_SELECTOR.totalAssets, encoded(100n)],
    [terminalAsset, ERC4626_SELECTOR.balanceOf + word(innerVault), encoded(100n)],
    [innerVault, ERC4626_SELECTOR.previewRedeem + word(100n), encoded(100n)],
  ].map(([to, data, result], index) => ({
    id: `rpc-${index + 1}`, to, data, result, blockHash: block.hash, observedAt,
  }));
  const code = [
    { address: outerVault, code: '0x6001', blockHash: block.hash, observedAt },
    { address: innerVault, code: '0x6002', blockHash: block.hash, observedAt },
    { address: terminalAsset, code: '0x6003', blockHash: block.hash, observedAt },
  ];
  const witness = (providerId: string) => ({
    providerId,
    rpc: { block, confirmed: true, calls: structuredClone(calls), failedCalls: [] },
    codes: structuredClone(code),
  });
  return {
    captureVersion: 1,
    scope: 'sepolia-two-layer-erc4626-custody',
    chainId: 11155111,
    owner,
    deployment: {
      outerVault,
      innerVault,
      terminalAsset,
      codeDigests: {
        outerVault: evidenceDigest('0x6001'),
        innerVault: evidenceDigest('0x6002'),
        terminalAsset: evidenceDigest('0x6003'),
      },
    },
    capturedAt: observedAt,
    witnesses: [witness(evidenceDigest('provider-a')), witness(evidenceDigest('provider-b'))],
    failures: [],
  };
}

test('two-layer Sepolia custody replay produces a recorded 2x control', async () => {
  const report = await replaySepoliaCustody(capture());
  assert.equal(report.status, 'matched');
  assert.equal(report.sourceMode, 'recorded-rpc');
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.metric, {
    kind: 'available',
    scope: 'sepolia-two-layer-control',
    terminalAsset,
    numeratorRaw: '200',
    denominatorRaw: '100',
    multipleMillionths: '2000000',
  });
});

test('bytecode, custody and provider disagreements suppress the Sepolia metric', async () => {
  const wrongCode = capture();
  wrongCode.witnesses[0]!.codes[0]!.code = '0x6009';
  assert.deepEqual((await replaySepoliaCustody(wrongCode)).findings, ['outerVault-code-mismatch']);

  const shortCustody = capture();
  const terminalCall = shortCustody.witnesses[0]!.rpc.calls.find(call => call.to === terminalAsset)!;
  terminalCall.result = encoded(99n);
  shortCustody.witnesses[1]!.rpc.calls.find(call => call.to === terminalAsset)!.result = encoded(99n);
  const shortReport = await replaySepoliaCustody(shortCustody);
  assert.equal(shortReport.status, 'incomplete');
  assert.deepEqual(shortReport.findings, ['terminal-custody-mismatch', 'inner-redemption-exceeds-custody']);
  assert.equal(shortReport.metric.kind, 'unavailable');

  const disagreement = capture();
  disagreement.witnesses[1]!.rpc.calls.find(call => call.to === terminalAsset)!.result = encoded(99n);
  assert.deepEqual((await replaySepoliaCustody(disagreement)).findings, ['provider-disagreement']);
});

test('Sepolia custody captures reject mixed-block or substituted code evidence', () => {
  const mixedBlock = capture();
  mixedBlock.witnesses[0]!.codes[0]!.blockHash = `0x${'cd'.repeat(32)}`;
  assert.throws(() => SepoliaCustodyCaptureSchema.parse(mixedBlock), /Code observation block mismatch/);

  const substituted = capture();
  substituted.witnesses[0]!.codes[0]!.address = `0x${'55'.repeat(20)}`;
  assert.throws(() => SepoliaCustodyCaptureSchema.parse(substituted), /Unexpected code observation/);
});
