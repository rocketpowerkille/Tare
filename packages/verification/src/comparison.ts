import { z } from 'zod/v4';
import { decodeAddress, decodeWords, word } from '../../sources/src/evm.js';
import { SourceFailure } from '../../sources/src/http.js';
import { SELECTOR } from '../../adapters/src/morpho-blue.js';
import type { ShareCheck, ShareFinding, ShareVerificationCapture } from './capture.js';

interface ShareComparison {
  checks: ShareCheck[];
  findings: ShareFinding[];
  status: 'matched' | 'mismatch' | 'incomplete';
}

function readCapturedCall(capture: ShareVerificationCapture, data: string): string {
  const call = capture.rpc.calls.find(call => call.to === capture.vault && call.data === data);
  if (!call) throw new SourceFailure('invalid-response', 'Missing RPC share observation');
  return call.result;
}

/** Pure evidence comparison, shared by acquisition, report validation and replay. */
export function compareShares(capture: ShareVerificationCapture): ShareComparison {
  const findings = [...capture.failures];
  const checks: ShareCheck[] = [];
  const gap = (stage: ShareFinding['stage'], code: string) => {
    findings.push({ stage, code });
  };
  const block = capture.rpc.block;
  const observation = capture.graph;
  if (!block || !capture.rpc.confirmed) gap('rpc', 'unconfirmed-block');
  if (!observation) gap('graph', 'missing-observation');

  if (block && observation) {
    const { data } = observation;
    const { vault, accountBalance: balance } = data;
    const blockNumber = BigInt(block.number);
    const sameBlock = BigInt(observation.requestedBlock) === blockNumber
      && BigInt(data._meta.block.number) === blockNumber
      && data._meta.block.hash === block.hash;

    if (!sameBlock) gap('graph', 'block-mismatch');
    if (data._meta.hasIndexingErrors) gap('graph', 'indexing-errors');
    if (capture.expectedDeployment && data._meta.deployment !== capture.expectedDeployment) {
      gap('graph', 'deployment-mismatch');
    }
    if (!vault || !balance) gap('graph', 'missing-entity');
    if (vault && (vault.id !== capture.vault || vault.chainId !== capture.chainId)) {
      gap('graph', 'vault-identity-mismatch');
    }
    if (balance && (balance.account !== capture.owner
      || balance.vault.id !== capture.vault
      || balance.id !== `${capture.vault}-${capture.owner}`)) {
      gap('graph', 'owner-identity-mismatch');
    }
    if (vault && (BigInt(vault.lastUpdateBlock) > blockNumber
      || BigInt(vault.indexedFromBlock) > BigInt(vault.lastUpdateBlock))) {
      gap('graph', 'invalid-history');
    }
    if (balance && (BigInt(balance.lastUpdateBlock) > blockNumber
      || (vault && BigInt(balance.lastUpdateBlock) < BigInt(vault.indexedFromBlock)))) {
      gap('graph', 'invalid-history');
    }

    if (findings.length === 0 && vault && balance) {
      const read = (data: string) => readCapturedCall(capture, data);
      try {
        const supply = decodeWords(read(SELECTOR.supply), 1)[0]!;
        const ownerShares = decodeWords(read(SELECTOR.balance + word(capture.owner)), 1)[0]!;
        if (ownerShares > supply || BigInt(balance.shares) > BigInt(vault.totalShares)) {
          gap('comparison', 'ownership-contradiction');
        }
        const values: [ShareCheck['field'], string, string][] = [
          ['asset', decodeAddress(read(SELECTOR.asset)), vault.asset],
          ['share-decimals', decodeWords(read(SELECTOR.decimals), 1)[0]!.toString(), String(vault.shareDecimals)],
          ['total-shares', supply.toString(), vault.totalShares],
          ['owner-shares', ownerShares.toString(), balance.shares],
        ];
        for (const [field, rpc, graph] of values) {
          checks.push({ field, rpc, graph, status: rpc === graph ? 'matched' : 'mismatch' });
        }
      } catch (error) {
        if (error instanceof SourceFailure || error instanceof z.ZodError) {
          gap('rpc', 'invalid-response');
        } else {
          throw error;
        }
      }
    }
  }

  if (findings.length) return { checks, findings, status: 'incomplete' };
  const allMatched = checks.length === 4 && checks.every(check => check.status === 'matched');
  return { checks, findings, status: allMatched ? 'matched' : 'mismatch' };
}
