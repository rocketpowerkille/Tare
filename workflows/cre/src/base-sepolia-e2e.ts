import { baseSepoliaCustodyEvidence } from '../../../packages/policy/src/base-sepolia.js';
import { decide } from '../../../packages/policy/src/decision.js';
import { configSchema } from './config.js';
import { encodeExit, evidenceHash } from './report.js';

const SHARES = '100000000000000000000';
const INVALID_SHARES = '99000000000000000000';
const MIN_ASSETS = '95000000000000000000';
const POLICY = { maxAgeSeconds: 300, maxConcentrationBps: 10000, maxMultipleBps: 15000 };
const ADDRESS = /^0x[0-9a-f]{40}$/;

type E2EManifest = {
  chainId: number;
  production: boolean;
  positionOwner: string;
  contracts: { outerVault: string; forwarder: string; receiver: string };
};

function manifestAddress(value: unknown, name: string): string {
  if (typeof value !== 'string' || !ADDRESS.test(value)) throw new Error(`Invalid ${name} in E2E manifest`);
  return value;
}

function parseManifest(input: unknown): E2EManifest {
  const value = input as Partial<E2EManifest> & {
    contracts?: { outerVault?: unknown; testForwarder?: unknown; mockForwarder?: unknown; receiver?: unknown };
  };
  if (value?.chainId !== 84532 || value.production !== false || typeof value.contracts !== 'object') {
    throw new Error('Expected the non-production Base Sepolia E2E manifest');
  }
  const forwarder = value.contracts.mockForwarder ?? value.contracts.testForwarder;
  return {
    chainId: value.chainId,
    production: value.production,
    positionOwner: manifestAddress(value.positionOwner, 'position owner'),
    contracts: {
      outerVault: manifestAddress(value.contracts?.outerVault, 'outer vault'),
      forwarder: manifestAddress(forwarder, 'forwarder'),
      receiver: manifestAddress(value.contracts?.receiver, 'receiver'),
    },
  };
}

export function createBaseSepoliaExitPlan(report: unknown, manifestInput: unknown, now: number) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid plan clock');
  const manifest = parseManifest(manifestInput);
  const evidence = baseSepoliaCustodyEvidence(report, {
    owner: manifest.positionOwner,
    vault: manifest.contracts.outerVault,
  });
  const decision = decide(evidence, POLICY, now, true);
  if (decision.action !== 'exit') throw new Error(`Fresh evidence did not authorize exit: ${decision.reason}`);
  const authorization = {
    enabled: true,
    receiver: manifest.contracts.receiver,
    shares: SHARES,
    minAssets: MIN_ASSETS,
    nonce: '1',
    validUntil: String(now + 300),
  };
  return {
    planVersion: 1,
    chainId: manifest.chainId,
    owner: manifest.positionOwner,
    vault: manifest.contracts.outerVault,
    forwarder: manifest.contracts.forwarder,
    receiver: manifest.contracts.receiver,
    shares: SHARES,
    minAssets: MIN_ASSETS,
    nonce: authorization.nonce,
    validUntil: authorization.validUntil,
    observedBlock: evidence.blockNumber,
    observedHash: evidence.blockHash,
    evidenceDigest: evidenceHash(evidence),
    payload: encodeExit(evidence, POLICY, now, authorization),
    invalidSharesPayload: encodeExit(evidence, POLICY, now, { ...authorization, shares: INVALID_SHARES }),
  };
}

export function createBaseSepoliaSimulationSetup(
  report: unknown,
  manifestInput: unknown,
  now: number,
  apiUrl = 'http://127.0.0.1:4318/api/analyze',
) {
  const plan = createBaseSepoliaExitPlan(report, manifestInput, now);
  const permitValidUntil = String(now + 3600);
  const config = configSchema.parse({
    schedule: '0 */5 * * * *',
    evidenceSource: 'base-sepolia-custody',
    apiUrl,
    owner: plan.owner,
    vault: plan.vault,
    graphDeployment: 'not-used-for-base-sepolia',
    policySecretId: 'TARE_PRIVATE_POLICY',
    apiSecretId: 'TARE_API_TOKEN',
    execution: {
      enabled: true,
      receiver: plan.receiver,
      shares: plan.shares,
      minAssets: plan.minAssets,
      nonce: plan.nonce,
      validUntil: permitValidUntil,
    },
  });
  return {
    config,
    approval: { token: plan.vault, spender: plan.receiver, shares: plan.shares },
    arm: {
      receiver: plan.receiver,
      vault: plan.vault,
      shares: plan.shares,
      minAssets: plan.minAssets,
      permitValidUntil,
    },
  };
}
