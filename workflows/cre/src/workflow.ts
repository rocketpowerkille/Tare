import { cre, bytesToBase64, ok, text, type TeeRuntime } from '@chainlink/cre-sdk';
import { PrivatePolicy } from '../../../packages/policy/src/decision.js';
import { v1Evidence } from '../../../packages/policy/src/v1.js';
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
  try {
    const config = configSchema.parse(runtime.config);
    const policyText = runtime.getSecret({ id: config.policySecretId }).result().value;
    if (policyText.length > 1024) throw new Error('Private policy exceeds limit');
    const policy = PrivatePolicy.parse(JSON.parse(policyText));
    const token = runtime.getSecret({ id: config.apiSecretId }).result().value;
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error('Invalid Tare API token');
    const resolution = request(runtime, token, { operation: 'resolve-v1', owner: config.owner, vault: config.vault });
    // Read only the block selector here; the projection below validates required evidence fields and identities.
    const selector = resolution as { capture?: { block?: { number?: unknown } } };
    const number = selector?.capture?.block?.number;
    if (typeof number !== 'string' || !/^0x[0-9a-fA-F]{1,8}$/.test(number)) throw new Error('Missing Tare block');
    const verification = request(runtime, token, { operation: 'verify-shares', owner: config.owner, vault: config.vault,
      blockNumber: BigInt(number).toString() });
    const evidence = v1Evidence(resolution, verification, { ...config, deployment: config.graphDeployment });
    const now = Math.floor(runtime.now().getTime() / 1000);
    return publishDecision(runtime, evidence, policy, now);
  } catch {
    // SDK/API/validation errors must not echo enclave secrets or private policy input.
    throw new Error('Confidential policy workflow failed; inspect execution status before retrying');
  }
}

export function initWorkflow(config: Config) {
  return [cre.handlerInTee(new cre.capabilities.CronCapability().trigger({ schedule: config.schedule }),
    onCronTrigger, [{ tee: 'nitro', regions: ['us-west-2'] }])];
}
