import { api } from './api';
import { record, text, type Capabilities, type JsonRecord, type PositionAnalyzeInput } from './types';
import { observeModule, observePrimary, type ProgressObserver } from './progress';

type ModuleStatus = 'complete' | 'verified' | 'incomplete' | 'mismatch' | 'unavailable' | 'not-used' | 'not-eligible';

interface EvidenceModule {
  id: 'position' | 'the-graph' | 'chainlink' | 'bazantic';
  name: string;
  partner: string | null;
  eligible: boolean;
  status: ModuleStatus;
  summary: string;
  report?: JsonRecord;
}

const ETHEREUM_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const ETHEREUM_WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

function baseStatus(report: JsonRecord): ModuleStatus {
  const status = text(report.status) ?? text(report.kind) ?? 'incomplete';
  return status === 'complete' || status === 'matched' ? 'complete'
    : status === 'mismatch' ? 'mismatch' : 'incomplete';
}

function graphModule(result: PromiseSettledResult<JsonRecord> | undefined): EvidenceModule {
  if (!result) return {
    id: 'the-graph', name: 'Indexed accounting cross-check', partner: 'The Graph', eligible: false,
    status: 'not-eligible', summary: 'Available for supported Ethereum MetaMorpho V1 positions.',
  };
  if (result.status === 'rejected') return {
    id: 'the-graph', name: 'Indexed accounting cross-check', partner: 'The Graph', eligible: true,
    status: 'unavailable', summary: result.reason instanceof Error ? result.reason.message : 'The Graph check was unavailable.',
  };
  const status = text(result.value.status);
  const checks = record(result.value.checks);
  const accountingApplicable = checks.accountingApplicable !== false;
  const tokenAmount = text(checks.tokenApiAmountRaw);
  const rpcAmount = text(checks.rpcAmountRaw);
  const tokenMatched = Boolean(tokenAmount && rpcAmount && tokenAmount === rpcAmount);
  const summary = status === 'matched'
    ? accountingApplicable
      ? 'The Graph Token API and Studio accounting agreed with direct blockchain readings.'
      : 'The Graph Token API vault-share balance matched the direct blockchain reading. Studio accounting is not configured for this vault.'
    : status === 'mismatch'
      ? 'At least one applicable Graph result disagreed with the direct blockchain evidence.'
      : tokenMatched
        ? 'The Graph Token API balance matched RPC, but the applicable Studio accounting evidence was incomplete.'
        : 'At least one applicable Graph result was missing, unavailable, or incomplete.';
  return {
    id: 'the-graph', name: 'Indexed position cross-check', partner: 'The Graph', eligible: true,
    status: status === 'matched' ? 'verified' : status === 'mismatch' ? 'mismatch' : 'incomplete',
    summary,
    report: result.value,
  };
}

function valuationInput(report: JsonRecord, input: PositionAnalyzeInput) {
  if ((input.chainId ?? 1) !== 1 || input.operation === 'resolve-v2') return undefined;
  const position = input.operation === 'resolve-v1' ? record(report.vault) : record(report.position);
  const asset = text(position.asset);
  const amountRaw = text(input.operation === 'resolve-v1' ? position.convertToAssetsRaw : position.assetsRaw);
  const assetDecimals = position.decimals;
  if (!asset || !amountRaw || typeof assetDecimals !== 'number'
    || ![ETHEREUM_USDC, ETHEREUM_WETH].includes(asset.toLowerCase())) return undefined;
  const block = record(record(report.capture).block);
  let blockNumber: string | undefined;
  try { blockNumber = block.number === undefined ? undefined : BigInt(String(block.number)).toString(); }
  catch { blockNumber = undefined; }
  return { chainId: 1 as const, asset, amountRaw, assetDecimals, ...(blockNumber ? { blockNumber } : {}) };
}

async function chainlinkModule(token: string, report: JsonRecord, input: PositionAnalyzeInput): Promise<EvidenceModule> {
  if (input.operation === 'resolve-v2') {
    const valuation = record(report.valuation);
    const available = valuation.kind === 'observed' && Object.keys(record(valuation.price)).length > 0;
    return {
      id: 'chainlink', name: 'Position valuation', partner: 'Chainlink', eligible: true,
      status: available ? 'verified' : 'incomplete',
      summary: available
        ? 'A Chainlink USDC/USD price was read with the nested position evidence.'
        : 'The position trace completed without an available Chainlink valuation.',
      ...(available ? { report: valuation } : {}),
    };
  }
  const valuation = valuationInput(report, input);
  if (!valuation) return {
    id: 'chainlink', name: 'Position valuation', partner: 'Chainlink', eligible: false,
    status: 'not-eligible', summary: 'No approved Chainlink price adapter is configured for this asset and network.',
  };
  try {
    const result = await api.valuePosition(token, valuation);
    return {
      id: 'chainlink', name: 'Position valuation', partner: 'Chainlink', eligible: true,
      status: 'verified', summary: 'The accounting quote was valued with a Chainlink feed at the checked block.', report: result,
    };
  } catch (failure) {
    return {
      id: 'chainlink', name: 'Position valuation', partner: 'Chainlink', eligible: true,
      status: 'unavailable', summary: failure instanceof Error ? failure.message : 'The Chainlink valuation was unavailable.',
    };
  }
}

function bazanticModule(token: string): EvidenceModule {
  if (token.startsWith('tare_sandbox_v1.')) return {
    id: 'bazantic', name: 'Paid access session', partner: 'Bazantic', eligible: true,
    status: 'verified', summary: 'This request was authorized by a signed Bazantic sandbox session.',
  };
  return {
    id: 'bazantic', name: 'Paid access session', partner: 'Bazantic', eligible: false,
    status: token ? 'not-used' : 'not-eligible',
    summary: token ? 'This request used a configured Tare access code, so no Bazantic payment was required.'
      : 'This local deployment does not require paid access.',
  };
}

export async function runComprehensiveCheck(token: string, capabilities: Capabilities, input: PositionAnalyzeInput, notify: ProgressObserver = () => {}) {
  const graphEligible = input.operation === 'resolve-v1' && (input.chainId ?? 1) === 1
    && capabilities.live['verify-graph-composition'];
  notify('position', 'active', 'Requesting shares, vault layers and allocations. These arrive in one API response.');
  notify('the-graph', graphEligible ? 'active' : 'unavailable', graphEligible ? 'Querying the configured Graph composition alongside the position trace.' : 'No eligible Graph composition for this operation and network.');
  const primaryPromise = api.analyze(token, input).then(result => {
    observePrimary(result, notify);
    return result;
  });
  const graphPromise = graphEligible
    ? api.analyze(token, { operation: 'verify-graph-composition', owner: input.owner, vault: input.vault })
    : undefined;
  const [primaryResult, graphResult] = await Promise.all([
    primaryPromise,
    graphPromise ? Promise.resolve(graphPromise).then(
      value => {
        const result = { status: 'fulfilled', value } as PromiseFulfilledResult<JsonRecord>;
        observeModule({ ...graphModule(result) }, notify);
        return result;
      },
      reason => {
        const result = { status: 'rejected', reason } as PromiseRejectedResult;
        observeModule({ ...graphModule(result) }, notify);
        return result;
      },
    ) : Promise.resolve(undefined),
  ]);

  notify('chainlink', 'active', 'Evaluating the asset adapter and requesting an eligible reference price.');
  const chainlink = await chainlinkModule(token, primaryResult, input);
  observeModule({ ...chainlink }, notify);
  const modules: EvidenceModule[] = [
    {
      id: 'position', name: 'Position and exposure', partner: null, eligible: true,
      status: baseStatus(primaryResult), summary: 'Direct blockchain readings produced the primary position report.', report: primaryResult,
    },
    graphModule(graphResult),
    chainlink,
    bazanticModule(token),
  ];
  const relevant = modules.filter(module => module.eligible);
  const status = relevant.some(module => module.status === 'mismatch') ? 'mismatch'
    : relevant.some(module => ['incomplete', 'unavailable'].includes(module.status)) ? 'incomplete'
      : 'complete';
  const primaryCapture = record(primaryResult.capture);
  const backingAvailable = record(primaryResult.metric).kind === 'available';
  notify('coverage', status === 'complete' && backingAvailable ? 'complete' : 'warning',
    backingAvailable ? 'Review the measured scope and all remaining limitations in the report.' : 'Position, accounting and price checks do not establish independent asset backing.');

  return {
    schemaVersion: 1,
    reportType: 'comprehensive-position-check',
    sourceMode: 'live-composed',
    status,
    operation: input.operation,
    owner: input.owner,
    vault: input.vault,
    chainId: input.chainId ?? 1,
    capturedAt: text(primaryCapture.capturedAt) ?? new Date().toISOString(),
    primary: primaryResult,
    modules,
    findings: modules.filter(module => module.eligible && !['complete', 'verified'].includes(module.status))
      .map(module => `${module.id}:${module.status}`),
  } satisfies JsonRecord;
}
