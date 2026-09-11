import { describe, expect, test } from 'bun:test';
import { decodeAbiParameters } from 'viem';
import { replayBaseSepoliaCustody } from '../../../packages/verification/src/base-sepolia-custody.js';
import { baseSepoliaCapture } from '../../../tests/helpers/base-sepolia.js';
import { createBaseSepoliaExitPlan } from '../src/base-sepolia-e2e.js';
import { EXIT_ABI } from '../src/report.js';

const manifest = {
  chainId: 84532,
  production: false,
  positionOwner: `0x${'11'.repeat(20)}`,
  contracts: {
    outerVault: `0x${'22'.repeat(20)}`,
    testForwarder: `0x${'55'.repeat(20)}`,
    receiver: `0x${'66'.repeat(20)}`,
  },
};

describe('Base Sepolia E2E exit preparation', () => {
  test('fresh live evidence produces the CRE-identical bounded and invalid-share payloads', async () => {
    const replay = await replayBaseSepoliaCustody(baseSepoliaCapture());
    const report = { ...replay, sourceMode: 'live-rpc' };
    const plan = createBaseSepoliaExitPlan(report, manifest, 1000);
    const valid = decodeAbiParameters(EXIT_ABI, plan.payload);
    const invalid = decodeAbiParameters(EXIT_ABI, plan.invalidSharesPayload);
    expect(valid[0]).toBe(84532n);
    expect(valid[1]).toBe(manifest.contracts.receiver);
    expect(valid[2]).toBe(manifest.positionOwner);
    expect(valid[3]).toBe(manifest.contracts.outerVault);
    expect(valid[4]).toBe(100000000000000000000n);
    expect(valid[5]).toBe(95000000000000000000n);
    expect(valid[6]).toBe(1n);
    expect(valid[7]).toBe(1300n);
    expect(valid[8]).toBe(99n);
    expect(valid[9]).toBe(`0x${'ab'.repeat(32)}`);
    expect(valid[10]).toBe(plan.evidenceDigest);
    expect(invalid[4]).toBe(99000000000000000000n);
  });

  test('recorded, stale and wrong-manifest evidence cannot create a plan', async () => {
    const replay = await replayBaseSepoliaCustody(baseSepoliaCapture());
    expect(() => createBaseSepoliaExitPlan(replay, manifest, 1000)).toThrow();
    expect(() => createBaseSepoliaExitPlan({ ...replay, sourceMode: 'live-rpc' }, manifest, 1301)).toThrow();
    expect(() => createBaseSepoliaExitPlan({ ...replay, sourceMode: 'live-rpc' },
      { ...manifest, production: true }, 1000)).toThrow();
  });
});
