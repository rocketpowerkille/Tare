import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../packages/policy/src/decision.js';
import { v1Evidence } from '../packages/policy/src/v1.js';
import { policyFixture, privatePolicy, testnetEvidence } from './helpers/policy.js';

test('real V1 evidence never becomes verified backing or an executable multiple', async () => {
  const f = await policyFixture();
  const evidence = v1Evidence(f.resolution, f.verification, f.expected);
  assert.equal(evidence.complete, true);
  assert.equal(evidence.backingVerified, false);
  assert.equal(evidence.multiple, null);
  assert.equal(decide(evidence, { ...privatePolicy, maxConcentrationBps: 1 }, f.now, true).action, 'review');
  assert.equal(decide(evidence, { ...privatePolicy, maxConcentrationBps: 10000 }, f.now, true).action, 'hold');
  const forged = { ...f.resolution, backingVerified: true, multiple: { numerator: '100', denominator: '1' } };
  assert.equal(v1Evidence(forged, f.verification, f.expected).backingVerified, false);
});

test('policy blocks stale, future, recorded, partial and mismatched input', async () => {
  const f = await policyFixture();
  const evidence = v1Evidence(f.resolution, f.verification, f.expected);
  for (const changed of [{ ...evidence, live: false }, { ...evidence, complete: false },
    { ...evidence, blockTimestamp: String(f.now + 1) }, { ...evidence, blockTimestamp: String(f.now - 301) }]) {
    assert.equal(decide(changed, privatePolicy, f.now, true).action, 'blocked');
  }
  assert.equal(v1Evidence(f.resolution, f.verification, { ...f.expected, owner: `0x${'0'.repeat(40)}` }).complete, false);
  assert.equal(v1Evidence(f.resolution, f.verification, { ...f.expected, deployment: 'OtherDeployment' }).complete, false);
  const mismatch = structuredClone(f.verification);
  mismatch.capture.rpc.block!.hash = `0x${'a'.repeat(64)}`;
  assert.equal(v1Evidence(f.resolution, mismatch, f.expected).complete, false);
});

test('only opted-in Sepolia evidence can pass the execution policy; threshold arithmetic stays exact', () => {
  assert.equal(decide(testnetEvidence, privatePolicy, 1000, true).action, 'exit');
  assert.equal(decide(testnetEvidence, privatePolicy, 1000).action, 'review');
  assert.equal(decide({ ...testnetEvidence, chainId: 1 }, privatePolicy, 1000, true).action, 'review');
  assert.equal(decide({ ...testnetEvidence, backingVerified: false }, privatePolicy, 1000, true).action, 'review');
  const denominator = 10n ** 70n;
  const equal = { ...testnetEvidence, largestMarketBps: 0, multiple: { numerator: String(denominator * 3n), denominator: String(denominator * 2n) } };
  assert.equal(decide(equal, privatePolicy, 1000, true).action, 'hold');
  equal.multiple.numerator = String(denominator * 3n + 1n);
  assert.equal(decide(equal, privatePolicy, 1000, true).action, 'exit');
  assert.throws(() => decide({ ...equal, multiple: { numerator: '1', denominator: '0' } }, privatePolicy, 1000, true));
});

test('policy rejects contradictory share checks and nonconserved allocations', async () => {
  const f = await policyFixture();
  const shares = structuredClone(f.verification);
  shares.checks[0]!.graph = 'different';
  assert.equal(v1Evidence(f.resolution, shares, f.expected).complete, false);
  const resolution = structuredClone(f.resolution);
  resolution.markets[0]!.attributedAssetsRaw = String(BigInt(resolution.markets[0]!.attributedAssetsRaw!) + 1n);
  assert.equal(v1Evidence(resolution, f.verification, f.expected).complete, false);
});
