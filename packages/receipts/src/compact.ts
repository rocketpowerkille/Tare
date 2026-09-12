type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function summarizeMarkets(value: unknown) {
  const markets = Array.isArray(value) ? value.map(record) : [];
  const counts = (key: string) => Object.fromEntries([...new Set(markets.map(market => market[key]).filter((item): item is string => typeof item === 'string'))]
    .map(item => [item, markets.filter(market => market[key] === item).length]));
  return {
    count: markets.length,
    typeCounts: counts('type'),
    backingVerificationCounts: counts('backingVerification'),
    exposures: markets.map(market => ({
      marketId: market.marketId,
      collateralToken: market.collateralToken,
      attributedAssetsRaw: market.attributedAssetsRaw,
    })),
  };
}

function summarizeAnalysis(value: unknown) {
  const analysis = record(value);
  const branches = Array.isArray(analysis.branches) ? analysis.branches.map(record) : [];
  const { branches: _branches, ...summary } = analysis;
  return {
    ...summary,
    branchCount: branches.length,
    branches: branches.map(branch => ({
      adapter: branch.adapter,
      vault: branch.vault,
      assetsRaw: branch.assetsRaw,
      attributedAssetsRaw: branch.attributedAssetsRaw,
      marketCount: Array.isArray(branch.markets) ? branch.markets.length : 0,
    })),
  };
}

function summarizeBacking(value: unknown) {
  const backing = record(value);
  const claims = Array.isArray(backing.claims) ? backing.claims.map(record) : [];
  const { claims: _claims, ...summary } = backing;
  return {
    ...summary,
    claimCount: claims.length,
    claims: claims.map(claim => ({
      marketId: typeof claim.id === 'string' ? claim.id.split(':')[1] : undefined,
      claimRaw: claim.claimRaw,
      accountingLiquidityUpperBoundRaw: claim.accountingLiquidityUpperBoundRaw,
      verifiedBackingRaw: claim.verifiedBackingRaw,
    })),
  };
}

function summarizeChecks(value: unknown) {
  const checks = Array.isArray(value) ? value.map(record) : [];
  const statusCounts = Object.fromEntries(
    [...new Set(checks.map(check => check.status).filter((status): status is string => typeof status === 'string'))]
      .map(status => [status, checks.filter(check => check.status === status).length]),
  );
  return {
    count: checks.length,
    statusCounts,
    failures: checks.filter(check => check.status !== 'matched').slice(0, 8).map(check => ({
      status: check.status,
      field: check.field,
      to: check.to,
      data: check.data,
      rpc: check.rpc,
      graph: check.graph,
    })),
  };
}

export function compactEvidenceReport(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'invalid-report', captureOmitted: true };
  }
  const { capture: _capture, markets, analysis, backing, checks, ...report } = value as Record<string, unknown>;
  return {
    ...report,
    ...(markets === undefined ? {} : { markets: summarizeMarkets(markets) }),
    ...(analysis === undefined ? {} : { analysis: summarizeAnalysis(analysis) }),
    ...(backing === undefined ? {} : { backing: summarizeBacking(backing) }),
    ...(checks === undefined ? {} : Array.isArray(checks)
      ? { checkSummary: summarizeChecks(checks) }
      : { checks }),
    captureOmitted: true,
    captureNote: 'Raw evidence and verbose traversal details are available from the full API; this agent view preserves verdicts, exposure summaries, metrics, findings, limitations and the evidence digest.',
  };
}
