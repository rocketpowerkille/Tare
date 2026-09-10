import { composePosition } from '../../service/src/composition.js';
import { resolveLivePosition } from '../../resolver/src/live.js';
import { verifyShares } from '../../verification/src/shares.js';
import { evidenceDigest } from '../../sources/src/recorded.js';
import type { ServiceConfig } from '../../service/src/index.js';
import type { Frame, Position } from './model.js';
import type { Evaluation } from './engine.js';

export async function evaluateCaptures(input: unknown, position: Position, block: Frame['block']): Promise<Evaluation> {
  const report = await composePosition(input);
  const capture = report.resolution.capture;
  if (capture.owner !== position.owner || capture.vault !== position.vault || capture.chainId !== position.chainId) {
    throw new Error('Monitor evidence position mismatch');
  }
  if (!capture.block || BigInt(capture.block.number) !== BigInt(block.number) || capture.block.hash !== block.hash) {
    throw new Error('Monitor stream/RPC block mismatch; checkpoint not advanced');
  }
  const findings = [...new Set([...report.findings, ...report.resolution.findings.map(finding => finding.code),
    ...report.verification.findings.map(finding => finding.code)])].sort();
  return { evidence: report.capture, summary: {
    status: report.status, findings, shares: report.resolution.vault?.sharesRaw ?? null,
    fee: report.resolution.vault?.feeRaw ?? null, metric: 'unavailable', evidenceDigest: evidenceDigest(report.capture),
    allocationDigest: evidenceDigest(report.resolution.markets.map(market => ({ id: market.marketId,
      loan: market.loanToken, collateral: market.collateralToken, oracle: market.oracle, irm: market.irm,
      lltv: market.lltvRaw, assets: market.attributedAssetsRaw }))),
  } };
}

export function liveEvaluator(position: Position, config: ServiceConfig) {
  const { rpcUrl, graphUrl, expectedDeployment } = config;
  if (!rpcUrl || !graphUrl || !expectedDeployment) throw new Error('Monitor requires TARE_RPC_URL, TARE_GRAPH_URL and TARE_GRAPH_DEPLOYMENT');
  return async (block: Frame['block']) => {
    const resolution = await resolveLivePosition({ ...position, rpcUrl, blockNumber: block.number });
    const verification = await verifyShares({ ...position, rpcUrl, graphUrl, expectedDeployment, blockNumber: block.number }, config.graphApiKey);
    return evaluateCaptures({ resolutionCapture: resolution.capture, shareCapture: verification.capture,
      graphResponse: { data: verification.capture.graph?.data ?? null } }, position, block);
  };
}
