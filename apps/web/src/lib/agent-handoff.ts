import { record } from './types';
import { BAZANTIC_GATEWAY_URL, BAZANTIC_PRICE_USDC } from './bazantic';

export const EXPLANATION_RECIPE = 'Explain DeFi Vault Evidence Clearly';
export const RECIPE_TOOLS = ['tare_status', 'tare_discover_vaults', 'tare_analyze_compact', 'tare_example_compact'];
export const BAZANTIC_RECIPE_URL = 'https://bazantic.com/recipes/explain-defi-vault-evidence-clearly';
export const RECIPE_SPEC_URL = 'https://github.com/rocketpowerkille/Tare/blob/main/docs/BAZANTIC_PLAIN_LANGUAGE_RECIPE.md';
const exampleIds = new Set(['steakhouse-usdc', 'ov-usdc-v2', 'weth-custody']);

export interface ReportAccess {
  route: 'direct-api';
  authorization: 'bazantic-session' | 'access-code' | 'not-required' | 'unknown';
  sessionId?: string;
  network?: 'base-sepolia';
  issuedAt?: string;
  expiresAt?: string;
  exampleId?: string;
}

function date(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return undefined;
  const result = new Date(value * 1000);
  return Number.isNaN(result.getTime()) ? undefined : result.toISOString();
}

/** UI-only provenance: call only after this report request succeeds. Never retain the credential. */
export function acceptedReportAccess(token: string, exampleId?: string, protectedApi = false): ReportAccess {
  const base: ReportAccess = { route: 'direct-api', authorization: token ? 'access-code' : 'not-required',
    ...(exampleId && exampleIds.has(exampleId) ? { exampleId } : {}) };
  if (!token.startsWith('tare_sandbox_v1.')) return base;
  if (!protectedApi) return { ...base, authorization: 'unknown' };
  try {
    const claims = record(JSON.parse(atob(token.split('.')[1]!.replaceAll('-', '+').replaceAll('_', '/'))));
    if (claims.network !== 'base-sepolia') return { ...base, authorization: 'unknown' };
    return { ...base, authorization: 'bazantic-session', network: 'base-sepolia',
      sessionId: typeof claims.sessionId === 'string' && /^[\w-]{1,128}$/.test(claims.sessionId) ? claims.sessionId : undefined,
      issuedAt: date(claims.issuedAt), expiresAt: date(claims.expiresAt) };
  } catch { return { ...base, authorization: 'unknown' }; }
}

export interface HandoffContext {
  operation: string;
  freshness: string;
  network: string;
  chainId?: number;
  owner?: string;
  vault?: string;
  observedBlock?: string;
  evidenceId?: string;
}

/** Build instructions, not an execution request. Unknown saved captures never become fresh calls. */
export function agentHandoff(context: HandoffContext, access?: ReportAccess) {
  const saved = context.freshness === 'saved-evidence';
  const exampleId = access?.exampleId && exampleIds.has(access.exampleId) ? access.exampleId : undefined;
  const owner = /^0x[\da-fA-F]{40}$/.test(context.owner ?? '') ? context.owner : undefined;
  const vault = /^0x[\da-fA-F]{40}$/.test(context.vault ?? '') ? context.vault : undefined;
  const block = /^(0|[1-9][0-9]{0,77})$/.test(context.observedBlock ?? '') ? context.observedBlock : undefined;
  const chainId = [1, 8453, 42161, 84532].includes(context.chainId ?? 0) ? context.chainId : undefined;
  const supportedPosition = context.operation === 'resolve-erc4626'
    || context.operation === 'resolve-v1' && chainId !== 84532
    || context.operation === 'resolve-v2' && chainId === 1;
  let path = '/api/status';
  let body: Record<string, string | number> | undefined;
  let instruction = saved
    ? 'Explain the copied evidence context. This tool set cannot rerun an arbitrary uploaded capture; do not substitute a live check or another example.'
    : 'Explain the copied evidence context. This handoff cannot reproduce this report operation from the available metadata. Do not substitute another operation or claim a new evidence check.';
  if (saved && exampleId) {
    path = '/api/agent-example';
    body = { id: exampleId };
    instruction = `Use tare_example_compact with id ${exampleId}. This is saved evidence, not a fresh blockchain check. Compare the returned block and digest with the reference below and disclose any difference.`;
  } else if (!saved && context.freshness.startsWith('live') && supportedPosition && owner && vault && chainId) {
    path = '/api/agent-analyze';
    body = { operation: context.operation, owner, vault, ...(context.operation === 'resolve-v2' ? {} : { chainId }), ...(block ? { blockNumber: block } : {}) };
    instruction = `Use tare_analyze_compact with ${JSON.stringify(body)}. This requests new reads${block ? ' at the specified block' : ''}; it does not automatically reproduce separate Graph or Chainlink checks from the UI. Disclose unavailable evidence or differing blocks.`;
  }
  const reference = [owner && `Wallet: ${owner}`, vault && `Vault: ${vault}`, chainId && `Chain ID: ${chainId}`, block && `Reference block: ${block}`,
    /^(sha256:|0x)[\da-fA-F]{64}$/.test(context.evidenceId ?? '') && `Reference evidence ID: ${context.evidenceId}`].filter(Boolean).join('\n');
  const task = `Use the Bazantic Recipe "${EXPLANATION_RECIPE}" with the Tare gateway. First call tare_status.\n${instruction}\n${reference}\nExplain what this position holds and whether the evidence establishes independent backing. Preserve source, block, status and limitations. Copy Tare's formatted amounts without rescaling. Do not treat accounting agreement, prices or payment as proof of custody or solvency. Answer in concise prose, not JSON, unless requested.`;
  const command = `baz curl "${BAZANTIC_GATEWAY_URL}${path}"${body ? ` -X POST -H "Content-Type: application/json" -d '${JSON.stringify(body)}'` : ''} --account tare-demo --max-amount ${BAZANTIC_PRICE_USDC} --json`;
  return { task, command, commandPurpose: body ? 'Fetch compact evidence through the gateway' : 'Check gateway access only',
    replaySupported: Boolean(body), saved };
}
