import { cre, bytesToBase64, ok, text, type TeeRuntime } from '@chainlink/cre-sdk';
import { PrivatePolicy } from '../../../packages/policy/src/decision.js';
import { v1AccountingEvidence } from '../../../packages/policy/src/v1.js';
import { baseSepoliaCustodyEvidence } from '../../../packages/policy/src/base-sepolia.js';
import { configSchema, type Config } from './config.js';
import { publishDecision } from './publish.js';
export { configSchema } from './config.js';

function request(runtime: TeeRuntime<Config>, token: string, body: unknown): unknown {
  const response = new cre.capabilities.HTTPClient().sendRequest(runtime, {
    url: runtime.config.apiUrl, method: 'POST', body: bytesToBase64(new TextEncoder().encode(JSON.stringify(body))),
    multiHeaders: { Authorization: { values: [`Bearer ${token}`] }, 'Content-Type': { values: ['application/json'] } },
    timeout: '180s',
  }).result();
  if (!ok(response) || response.body.length > 5 * 1024 * 1024) throw new Error('Tare API unavailable or response exceeds limit');
  return JSON.parse(text(response)) as unknown;
}

export function onCronTrigger(runtime: TeeRuntime<Config>) {
  let stage = 'config';
  try {
    const config = configSchema.parse(runtime.config);
    stage = 'policy-secret';
    const policyText = runtime.getSecret({ id: config.policySecretId }).result().value;
    if (policyText.length > 1024) throw new Error('Private policy exceeds limit');
    stage = 'policy';
    const policy = PrivatePolicy.parse(JSON.parse(policyText));
    stage = 'api-secret';
    const token = runtime.getSecret({ id: config.apiSecretId }).result().value;
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error('Invalid Tare API token');
    let evidence;
    if (config.evidenceSource === 'base-sepolia-custody') {
      stage = 'base-custody';
      const custody = request(runtime, token, { operation: 'verify-base-custody', owner: config.owner });
      stage = 'evidence';
      evidence = baseSepoliaCustodyEvidence(custody, config);
    } else {
      stage = 'resolve';
      const resolution = request(runtime, token, { operation: 'resolve-v1', owner: config.owner, vault: config.vault });
      // Read only the block selector here; the projection below validates required evidence fields and identities.
      stage = 'block-selector';
      const selector = resolution as { capture?: { block?: { number?: unknown } } };
      const number = selector?.capture?.block?.number;
      if (typeof number !== 'string' || !/^0x[0-9a-fA-F]{1,8}$/.test(number)) throw new Error('Missing Tare block');
      stage = 'accounting';
      const verification = request(runtime, token, { operation: 'verify-accounting', vault: config.vault,
        blockNumber: BigInt(number).toString() });
      stage = 'evidence';
      evidence = v1AccountingEvidence(resolution, verification, { ...config, deployment: config.graphDeployment });
    }
    const now = Math.floor(runtime.now().getTime() / 1000);
    stage = 'publish';
    return publishDecision(runtime, evidence, policy, now);
  } catch {
    // SDK/API/validation errors must not echo enclave secrets or private policy input.
    throw new Error(`Confidential policy workflow failed at ${stage}; inspect execution status before retrying`);
  }
}

export function initWorkflow(config: Config) {
  return [cre.handlerInTee(new cre.capabilities.CronCapability().trigger({ schedule: config.schedule }),
    onCronTrigger, [{ tee: 'nitro', regions: ['us-west-2'] }])];
}
