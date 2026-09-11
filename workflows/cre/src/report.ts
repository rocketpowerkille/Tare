import { encodeAbiParameters, keccak256, stringToBytes } from 'viem';
import { Evidence, decide, type Decision } from '../../../packages/policy/src/decision.js';
import type { Config } from './config.js';

export function evidenceHash(evidence: Evidence) {
  return keccak256(stringToBytes(JSON.stringify(Evidence.parse(evidence))));
}
export function encodeVerdict(evidence: Evidence, decision: Decision) {
  const action = { blocked: 0, hold: 1, review: 2, exit: 3 }[decision.action];
  return encodeAbiParameters([{ type: 'uint8' }, { type: 'bytes32' }], [action, evidenceHash(evidence)]);
}
export const EXIT_ABI = [
  { type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'address' },
  { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
  { type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' },
] as const;

export function encodeExit(raw: unknown, privatePolicy: unknown, now: number, authorization: Config['execution']) {
  const evidence = Evidence.parse(raw);
  if (!authorization.enabled || decide(evidence, privatePolicy, now, true).action !== 'exit') throw new Error('Evidence does not authorize an exit');
  const shares = BigInt(authorization.shares);
  const minAssets = BigInt(authorization.minAssets);
  const nonce = BigInt(authorization.nonce);
  const permitValidUntil = BigInt(authorization.validUntil);
  if (!/^0x[0-9a-f]{40}$/.test(authorization.receiver) || /^0x0{40}$/.test(authorization.receiver)
      || shares <= 0n || minAssets <= 0n || nonce <= 0n || permitValidUntil <= BigInt(now)) {
    throw new Error('Invalid or expired exit authorization');
  }
  const validUntil = permitValidUntil < BigInt(now) + 600n ? permitValidUntil : BigInt(now) + 600n;
  return encodeAbiParameters(EXIT_ABI, [BigInt(evidence.chainId), authorization.receiver as `0x${string}`,
    evidence.owner as `0x${string}`, evidence.vault as `0x${string}`, shares, minAssets, nonce, validUntil,
    BigInt(evidence.blockNumber), evidence.blockHash as `0x${string}`, evidenceHash(evidence)]);
}
