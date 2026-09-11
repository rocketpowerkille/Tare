import { readTwoLayerCustody } from '../../adapters/src/erc4626-custody.js';
import { SourceFailure } from '../../sources/src/http.js';
import { evidenceDigest, RecordedReader } from '../../sources/src/recorded.js';
import { SepoliaCustodyCaptureSchema } from './sepolia-custody-capture.js';

const MAX_UINT256 = 2n ** 256n - 1n;

function deploymentFindings(capture: ReturnType<typeof SepoliaCustodyCaptureSchema.parse>, index: number) {
  const witness = capture.witnesses[index]!;
  const expected = capture.deployment.codeDigests;
  const codes = new Map(witness.codes.map(item => [item.address, evidenceDigest(item.code)]));
  const findings: string[] = [];
  for (const [name, address] of [
    ['outerVault', capture.deployment.outerVault],
    ['innerVault', capture.deployment.innerVault],
    ['terminalAsset', capture.deployment.terminalAsset],
  ] as const) {
    if (codes.get(address) !== expected[name]) findings.push(`${name}-code-mismatch`);
  }
  return findings;
}

function accountingFindings(
  view: Awaited<ReturnType<typeof readTwoLayerCustody>>,
  capture: ReturnType<typeof SepoliaCustodyCaptureSchema.parse>,
) {
  const findings: string[] = [];
  const values = Object.fromEntries(Object.entries(view)
    .filter((entry): entry is [string, string] => !entry[0].endsWith('Asset'))
    .map(([name, value]) => [name, BigInt(value)]));
  if (view.outerAsset !== capture.deployment.innerVault) findings.push('outer-asset-mismatch');
  if (view.innerAsset !== capture.deployment.terminalAsset) findings.push('inner-asset-mismatch');
  if (values.ownerShares === 0n) findings.push('zero-position');
  if (values.outerSupply === 0n || values.innerSupply === 0n) findings.push('zero-supply');
  if (values.ownerShares! > values.outerSupply!) findings.push('owner-shares-exceed-supply');
  if (values.outerCustodyShares! > values.innerSupply!) findings.push('outer-custody-exceeds-inner-supply');
  if (values.outerAssets !== values.outerCustodyShares) findings.push('outer-custody-mismatch');
  if (values.innerAssets !== values.terminalCustody) findings.push('terminal-custody-mismatch');
  if (values.ownerInnerShares! > values.outerCustodyShares!) findings.push('outer-redemption-exceeds-custody');
  if (values.ownerTerminalAssets! > values.terminalCustody!) findings.push('inner-redemption-exceeds-custody');
  if (values.ownerTerminalAssets === 0n) findings.push('redemption-rounds-to-zero');
  if (values.ownerTerminalAssets! > MAX_UINT256 / 2n) findings.push('metric-overflow');
  return findings;
}

export async function replaySepoliaCustody(input: unknown) {
  const capture = SepoliaCustodyCaptureSchema.parse(input);
  const findings = [...capture.failures];
  const [first, second] = capture.witnesses;
  if (first.providerId === second.providerId) findings.push('same-provider');
  if (!first.rpc.confirmed || !second.rpc.confirmed || !first.rpc.block || !second.rpc.block) findings.push('unconfirmed-block');
  if (JSON.stringify(first.rpc.block) !== JSON.stringify(second.rpc.block)) findings.push('block-mismatch');
  findings.push(...deploymentFindings(capture, 0), ...deploymentFindings(capture, 1));

  const views: Awaited<ReturnType<typeof readTwoLayerCustody>>[] = [];
  if (!findings.length) {
    for (const witness of capture.witnesses) {
      try {
        views.push(await readTwoLayerCustody(new RecordedReader(witness.rpc), capture.deployment, capture.owner));
      } catch (error) {
        if (!(error instanceof SourceFailure)) throw error;
        findings.push(error.code);
      }
    }
    if (views.length === 2 && JSON.stringify(views[0]) !== JSON.stringify(views[1])) findings.push('provider-disagreement');
    if (views[0]) findings.push(...accountingFindings(views[0], capture));
  }
  const view = findings.length ? null : views[0]!;
  const terminal = view ? BigInt(view.ownerTerminalAssets) : null;
  return {
    reportType: 'sepolia-custody' as const,
    schemaVersion: 1,
    sourceMode: 'recorded-rpc' as const,
    status: findings.length ? 'incomplete' as const : 'matched' as const,
    captureDigest: evidenceDigest(capture),
    capture,
    findings: [...new Set(findings)],
    view,
    verification: 'two-provider-bytecode-and-direct-custody' as const,
    metric: terminal === null
      ? { kind: 'unavailable' as const, reasons: [...new Set(findings)] }
      : { kind: 'available' as const, scope: 'sepolia-two-layer-control' as const,
        terminalAsset: capture.deployment.terminalAsset,
        numeratorRaw: (terminal * 2n).toString(), denominatorRaw: terminal.toString(),
        multipleMillionths: '2000000' },
    limitations: ['recorded-evidence-is-not-fresh', 'approved-testnet-control-only', 'provider-independence-not-proven'],
  };
}
