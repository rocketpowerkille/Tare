import { cre, hexToBase64, TxStatus, type TeeRuntime } from '@chainlink/cre-sdk';
import { EVM_PB } from '@chainlink/cre-sdk/pb';
import { decide, type Evidence } from '../../../packages/policy/src/decision.js';
import { encodeExit, encodeVerdict, evidenceHash } from './report.js';
import type { Config } from './config.js';

export const BASE_SEPOLIA_CHAIN_SELECTOR = 10344971235874465080n;

/** Receives evidence from the trusted adapter inside the enclave, never arbitrary API input. */
export function publishDecision(runtime: TeeRuntime<Config>, evidence: Evidence, policy: unknown, now: number) {
  const execution = runtime.config.execution;
  const decision = decide(evidence, policy, now, execution.enabled);
  const payload = decision.action === 'exit'
    ? encodeExit(evidence, policy, now, execution)
    : encodeVerdict(evidence, decision);
  // Only the verdict/commitment or explicit public exit terms cross the enclave boundary.
  const don = runtime.usingTheDons();
  const report = don.report({
    encodedPayload: hexToBase64(payload), encoderName: 'evm', signingAlgo: 'ecdsa', hashingAlgo: 'keccak256',
  }).result();
  if (decision.action === 'exit') {
    const result = new cre.capabilities.EVMClient(BASE_SEPOLIA_CHAIN_SELECTOR).writeReport(don, {
      receiver: execution.receiver, report, gasConfig: { gasLimit: '500000' },
    }).result();
    if (result.txStatus !== TxStatus.SUCCESS
        || result.receiverContractExecutionStatus !== EVM_PB.ReceiverContractExecutionStatus.SUCCESS) {
      throw new Error('Exit execution was not confirmed successful');
    }
  }
  return { ...decision, evidenceDigest: evidenceHash(evidence) };
}
