import { address, array, code, metadata, object, raw, timestamp } from './explanation-data.js';

const normalizedAddress = (value: unknown) => address(value)?.toLowerCase();
const marketId = (value: unknown) => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : undefined;

/** Bounded, browser-safe projection. Report claims are not authenticated by this helper. */
export function positionSnapshot(input: unknown) {
  const envelope = object(input);
  const report = object(envelope.primary ?? envelope.resolution ?? input);
  const provenance = metadata(report);
  const supported = report.protocol === 'metamorpho-v1-blue-v1' ? [1, 8453, 42161].includes(provenance.chainId ?? 0)
    : report.protocol === 'erc4626' && [1, 8453, 42161, 84532].includes(provenance.chainId ?? 0);
  const capture = object(report.capture);
  const block = object(capture.block);
  const blockTime = typeof block.timestamp === 'string' && /^0x[0-9a-f]{1,16}$/i.test(block.timestamp)
    ? BigInt(block.timestamp).toString() : block.timestamp;
  const vault = object(report.protocol === 'erc4626' ? report.position : report.vault);
  const decimals = typeof vault.decimals === 'number' && Number.isInteger(vault.decimals) && vault.decimals >= 0 && vault.decimals <= 36 ? vault.decimals : undefined;
  const confirmed = capture.blockConfirmed === true
    && (capture.chainId === undefined || capture.chainId === provenance.chainId)
    && (capture.owner === undefined || normalizedAddress(capture.owner) === normalizedAddress(provenance.owner))
    && (capture.vault === undefined || normalizedAddress(capture.vault) === normalizedAddress(provenance.vault));
  const marketInputs = array(report.markets);
  const markets = marketInputs.slice(0, 64).map(object).map(item => ({
    marketId: marketId(item.marketId), loanToken: normalizedAddress(item.loanToken),
    collateralToken: normalizedAddress(item.collateralToken), oracle: normalizedAddress(item.oracle),
    irm: normalizedAddress(item.irm), lltvRaw: raw(item.lltvRaw),
    vaultAssetsRaw: raw(item.vaultAssetsRaw), attributedAssetsRaw: confirmed ? raw(item.attributedAssetsRaw) : undefined,
  }));
  const duplicateMarkets = new Set(markets.filter((item, index) => item.marketId && markets.findIndex(other => other.marketId === item.marketId) !== index).map(item => item.marketId));
  const validMarkets = markets.filter(item => item.marketId && !duplicateMarkets.has(item.marketId)).sort((a, b) => a.marketId!.localeCompare(b.marketId!));
  const coverage = object(report.coverage);
  const completeMarkets = report.protocol === 'metamorpho-v1-blue-v1' && report.kind === 'complete' && confirmed
    && marketInputs.length <= 64 && validMarkets.length === marketInputs.length
    && coverage.expectedMarkets === marketInputs.length && coverage.observedMarkets === marketInputs.length;
  const source = array(envelope.modules).map(object).find(item => item.id === 'the-graph');
  const graph = object(source?.report);
  const graphMeta = metadata(graph);
  const aligned = graphMeta.chainId === provenance.chainId && graphMeta.observedBlock !== undefined
    && graphMeta.observedBlock === provenance.observedBlock && graphMeta.blockHash !== undefined
    && graphMeta.blockHash === provenance.blockHash && normalizedAddress(graphMeta.vault) === normalizedAddress(provenance.vault);
  const checks = array(graph.checks).map(object);
  const graphStatus = code(graph.status ?? source?.status) ?? 'not-included';
  const comparison = graph.reportType === 'accounting-verification' && aligned && graphStatus === 'matched'
    && object(object(graph.capture).rpc).confirmed === true && checks.length > 0 && checks.every(check => check.status === 'matched');
  return {
    supported, protocol: code(report.protocol), status: code(report.kind ?? report.status) ?? 'unavailable',
    ...provenance, owner: normalizedAddress(provenance.owner), vault: normalizedAddress(provenance.vault),
    blockTimestamp: timestamp(blockTime), confirmed,
    asset: normalizedAddress(vault.asset), decimals,
    sharesRaw: raw(vault.sharesRaw), totalSupplyRaw: raw(vault.totalSupplyRaw), totalAssetsRaw: raw(vault.totalAssetsRaw),
    conversionQuoteRaw: raw(vault.convertToAssetsRaw ?? vault.assetsRaw), feeRaw: raw(vault.feeRaw),
    markets: validMarkets, completeMarkets, omittedMarkets: marketInputs.length - validMarkets.length,
    graph: { status: graphStatus, aligned, supportsAccounting: comparison, provenance: graphMeta,
      scope: 'Indexed vault accounting versus RPC only; not wallet ownership, custody or backing.' },
    freshness: /^(recorded|replay)/.test(provenance.sourceMode) ? 'saved-evidence'
      : provenance.sourceMode.startsWith('live') ? 'live-acquisition-at-requested-block' : 'unknown',
  };
}

export type PositionSnapshot = ReturnType<typeof positionSnapshot>;
