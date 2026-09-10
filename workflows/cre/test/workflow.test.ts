import assert from 'node:assert/strict';
import { test, newTestRuntime, HttpActionsMock, EvmMock } from '@chainlink/cre-sdk/test';
import type { TeeRuntime } from '@chainlink/cre-sdk';
import { initWorkflow, onCronTrigger } from '../src/workflow.js';
import { configSchema, type Config } from '../src/config.js';
import { policyFixture, privatePolicy, testnetEvidence } from '../../../tests/helpers/policy.js';
import { publishDecision } from '../src/publish.js';
import { Evidence } from '../../../packages/policy/src/decision.js';

async function harness(threshold = 5000) {
  const fixture = await policyFixture();
  const policyText = JSON.stringify({ ...privatePolicy, maxConcentrationBps: threshold });
  const token = 'local-test-token-'.repeat(3);
  const config = configSchema.parse({ schedule: '0 */5 * * * *', apiUrl: 'https://tare.example.invalid/api/analyze',
    owner: fixture.expected.owner, vault: fixture.expected.vault, graphDeployment: fixture.expected.deployment, policySecretId: 'POLICY', apiSecretId: 'API',
    execution: { enabled: true, receiver: `0x${'3'.repeat(40)}`, shares: '100', minAssets: '95', nonce: '1', validUntil: String(fixture.now + 300) },
  });
  const base = newTestRuntime(new Map([['main', new Map([['POLICY', policyText], ['API', token]])]]),
    { timeProvider: () => fixture.now * 1000 }, config);
  const signed: Uint8Array[] = [];
  const report = base.report.bind(base);
  base.report = input => {
    signed.push(typeof input.encodedPayload === 'string' ? Buffer.from(input.encodedPayload, 'base64') : input.encodedPayload!);
    return report(input);
  };
  const runtime: TeeRuntime<Config> = { config, now: () => base.now(), log: () => assert.fail('Enclave must not log'),
    getSecret: base.getSecret.bind(base), getSecrets: base.getSecrets.bind(base), callCapability: base.callCapability.bind(base),
    reportFromDon: base.report.bind(base), usingTheDons: () => base };
  const requests: unknown[] = [];
  HttpActionsMock.testInstance().sendRequest = request => {
    assert.equal(request.url, config.apiUrl);
    assert.deepEqual(request.multiHeaders.Authorization?.values, [`Bearer ${token}`]);
    const body = JSON.parse(new TextDecoder().decode(request.body));
    requests.push(body);
    if (body.operation === 'verify-shares') assert.equal(body.blockNumber, String(BigInt(fixture.resolution.capture.block!.number)));
    return { statusCode: 200, body: Buffer.from(JSON.stringify(body.operation === 'resolve-v1' ? fixture.resolution : fixture.verification)).toString('base64') };
  };
  return { fixture, runtime, config, signed, requests, token, policyText, base };
}

test('confidential handler consumes both Tare reports, signs a redacted review and cannot exit V1', async () => {
  const h = await harness(1);
  assert.equal(h.runtime.getSecret({ id: 'API' }).result().value, h.token);
  assert.equal(h.runtime.getSecret({ id: 'POLICY' }).result().value, h.policyText);
  assert.ok(initWorkflow(h.config)[0]!.requirements);
  const result = onCronTrigger(h.runtime);
  assert.equal(result.action, 'review');
  assert.equal(h.requests.length, 2);
  assert.equal(h.signed.length, 1);
  assert.equal(h.signed[0]!.length, 64);
  for (const output of [JSON.stringify(result), Buffer.from(h.signed[0]!).toString('utf8'), ...h.base.getLogs()]) {
    assert.ok(!output.includes(h.token) && !output.includes(h.policyText));
  }
});

test('changing only the private threshold changes the verdict', async () => {
  const h = await harness(10000);
  assert.equal(onCronTrigger(h.runtime).action, 'hold');
});

test('synthetic eligible Sepolia evidence reaches writeReport; failed or unknown execution is not success', async () => {
  const h = await harness();
  h.config.execution.validUntil = '1400';
  const evidence = Evidence.parse(testnetEvidence);
  let writes = 0;
  EvmMock.testInstance(16015286601757825753n).writeReport = request => {
    writes++;
    assert.equal(Buffer.from(request.receiver).toString('hex'), h.config.execution.receiver.slice(2));
    assert.ok(request.report);
    return { txStatus: 'TX_STATUS_SUCCESS', receiverContractExecutionStatus: 'RECEIVER_CONTRACT_EXECUTION_STATUS_SUCCESS' };
  };
  assert.equal(publishDecision(h.runtime, evidence, privatePolicy, 1000).action, 'exit');
  assert.equal(h.signed[0]!.length, 352);
  assert.equal(writes, 1);
  for (const reply of [
    { txStatus: 'TX_STATUS_REVERTED' as const },
    { txStatus: 'TX_STATUS_SUCCESS' as const },
    { txStatus: 'TX_STATUS_SUCCESS' as const, receiverContractExecutionStatus: 'RECEIVER_CONTRACT_EXECUTION_STATUS_REVERTED' as const },
  ]) {
    EvmMock.testInstance(16015286601757825753n).writeReport = () => reply;
    assert.throws(() => publishDecision(h.runtime, evidence, privatePolicy, 1000), /not confirmed successful/);
  }
});

test('recorded, stale and unverified evidence never calls writeReport', async () => {
  const h = await harness();
  EvmMock.testInstance(16015286601757825753n).writeReport = () => assert.fail('Ineligible evidence reached execution');
  for (const changed of [{ live: false }, { blockTimestamp: '1' }, { backingVerified: false }, { chainId: 1 }]) {
    const result = publishDecision(h.runtime, Evidence.parse({ ...testnetEvidence, ...changed }), privatePolicy, 1000);
    assert.notEqual(result.action, 'exit');
  }
});

test('API failure and invalid private configuration never sign or leak response data', async () => {
  const h = await harness();
  HttpActionsMock.testInstance().sendRequest = () => { throw new Error(h.token); };
  assert.throws(() => onCronTrigger(h.runtime), error => error instanceof Error && error.message === 'Confidential policy workflow failed; inspect execution status before retrying');
  assert.equal(h.signed.length, 0);
  assert.throws(() => configSchema.parse({ ...h.config, apiUrl: 'http://example.com/api/analyze' }));
});
