import { fileURLToPath } from 'node:url';
import { resolveLivePosition, replayLiveCapture } from '../../resolver/src/live.js';
import { resolveNestedPosition, replayNestedCapture } from '../../resolver/src/nested.js';
import { verifyShares, replayShareVerification } from '../../verification/src/shares.js';
import { verifyAccounting, replayAccounting } from '../../verification/src/accounting.js';
import { verifyWethCustody, replayCustody } from '../../verification/src/custody.js';
import { verifyBaseSepoliaCustody, replayBaseSepoliaCustody } from '../../verification/src/base-sepolia-custody.js';
import { BaseSepoliaCustodyDeploymentSchema } from '../../verification/src/base-sepolia-custody-capture.js';
import type { BaseSepoliaCustodyDeployment } from '../../verification/src/base-sepolia-custody-capture.js';
import { readJsonFile } from '../../sources/src/snapshot.js';
import { MorphoDiscovery } from '../../sources/src/morpho.js';
import { resolveErc4626Position, replayErc4626Capture } from '../../resolver/src/erc4626.js';
import { z } from 'zod/v4';
import { AddressSchema, SupportedEvmChainSchema } from '../../domain/src/index.js';
import { AnalyzeSchema, DiscoverSchema, ReplaySchema, ExampleSchema, MAX_INPUT_BYTES, ServiceError } from './requests.js';
import { composePosition } from './composition.js';

export interface ServiceConfig {
  rpcUrl?: string;
  secondaryRpcUrl?: string;
  graphUrl?: string;
  expectedDeployment?: string;
  graphApiKey?: string;
  morphoUrl?: string;
  baseRpcUrl?: string;
  baseSecondaryRpcUrl?: string;
  baseCustodyDeployment?: BaseSepoliaCustodyDeployment;
  baseMainnetRpcUrl?: string;
  arbitrumRpcUrl?: string;
  erc4626Registry?: VaultRegistryEntry[];
}
const VaultRegistryEntrySchema = z.strictObject({
  chainId: SupportedEvmChainSchema,
  vault: AddressSchema,
  name: z.string().min(1).max(200),
  protocol: z.string().regex(/^[a-zA-Z0-9._-]{1,40}$/),
});
type VaultRegistryEntry = z.infer<typeof VaultRegistryEntrySchema>;
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const config: ServiceConfig = Object.fromEntries(Object.entries({
    rpcUrl: env.TARE_RPC_URL, secondaryRpcUrl: env.TARE_SECONDARY_RPC_URL,
    graphUrl: env.TARE_GRAPH_URL, expectedDeployment: env.TARE_GRAPH_DEPLOYMENT,
    graphApiKey: env.GRAPH_API_KEY,
    morphoUrl: env.TARE_MORPHO_URL,
    baseRpcUrl: env.TARE_BASE_RPC_URL, baseSecondaryRpcUrl: env.TARE_BASE_SECONDARY_RPC_URL,
    baseMainnetRpcUrl: env.TARE_BASE_MAINNET_RPC_URL, arbitrumRpcUrl: env.TARE_ARBITRUM_RPC_URL,
  }).filter((entry): entry is [string, string] => Boolean(entry[1])));
  if (env.TARE_BASE_CUSTODY_DEPLOYMENT) {
    try {
      config.baseCustodyDeployment = BaseSepoliaCustodyDeploymentSchema.parse(
        JSON.parse(env.TARE_BASE_CUSTODY_DEPLOYMENT),
      );
    } catch {
      throw new Error('TARE_BASE_CUSTODY_DEPLOYMENT must contain a valid allowlisted deployment.');
    }
  }
  if (env.TARE_ERC4626_REGISTRY) {
    try { config.erc4626Registry = z.array(VaultRegistryEntrySchema).max(25).parse(JSON.parse(env.TARE_ERC4626_REGISTRY)); }
    catch { throw new Error('TARE_ERC4626_REGISTRY must contain valid public ERC-4626 vault entries.'); }
  }
  return config;
}

export const examples = [
  { id: 'steakhouse-usdc', operation: 'resolve-v1', label: 'Steakhouse USDC · V1 → Blue' },
  { id: 'ov-usdc-v2', operation: 'resolve-v2', label: 'OV USDC · V2 → V1 → Blue' },
  { id: 'weth-custody', operation: 'verify-weth', label: 'WETH custody · wrapper-only control' },
] as const;

export class TareService {
  private active = 0;
  private readonly config: Readonly<ServiceConfig>;
  constructor(config: ServiceConfig = {}) { this.config = Object.freeze({ ...config }); }

  capabilities() {
    const rpc = Boolean(this.config.rpcUrl);
    const graph = rpc && Boolean(this.config.graphUrl);
    return {
      name: 'tare', apiVersion: 1, chainId: 1, readOnly: true, examples,
      live: { 'resolve-v1': rpc || Boolean(this.config.baseMainnetRpcUrl || this.config.arbitrumRpcUrl), 'resolve-v2': rpc,
        'resolve-erc4626': rpc || Boolean(this.config.baseMainnetRpcUrl || this.config.arbitrumRpcUrl || this.config.baseRpcUrl), 'verify-shares': graph,
        'verify-accounting': graph, 'verify-weth': rpc && Boolean(this.config.secondaryRpcUrl),
        'verify-base-custody': Boolean(this.config.baseRpcUrl && this.config.baseSecondaryRpcUrl
          && this.config.baseCustodyDeployment) },
      limits: { maxInputBytes: MAX_INPUT_BYTES, concurrentOperations: 2 },
      limitations: ['Recorded evidence is unsigned and is not a fresh source check.',
        'Morpho backing remains unverified; the WETH metric applies only to the wrapper.'],
      networks: [
        { chainId: 1, name: 'Ethereum', resolveV1: Boolean(this.config.rpcUrl), erc4626: Boolean(this.config.rpcUrl) },
        { chainId: 8453, name: 'Base', resolveV1: Boolean(this.config.baseMainnetRpcUrl), erc4626: Boolean(this.config.baseMainnetRpcUrl) },
        { chainId: 42161, name: 'Arbitrum', resolveV1: Boolean(this.config.arbitrumRpcUrl), erc4626: Boolean(this.config.arbitrumRpcUrl) },
        { chainId: 84532, name: 'Base Sepolia', resolveV1: false, erc4626: Boolean(this.config.baseRpcUrl) },
      ],
    };
  }

  // Shared across transports: requests cannot choose provider URLs, paths or credentials.
  async run(action: 'analyze' | 'discover' | 'replay' | 'example' | 'compose', input: unknown): Promise<unknown> {
    const serialized = JSON.stringify(input);
    if (!serialized || Buffer.byteLength(serialized) > MAX_INPUT_BYTES) {
      throw new ServiceError(413, 'input-too-large', 'Input exceeds the 5 MiB limit.');
    }
    if (this.active >= 2) throw new ServiceError(429, 'busy', 'Two operations are running; retry when one finishes.');
    this.active++;
    try {
      if (action === 'analyze') return await this.analyze(input);
      if (action === 'discover') return await this.discover(input);
      if (action === 'replay') return await this.replay(input);
      if (action === 'compose') return await composePosition(input);
      const { id } = ExampleSchema.parse(input);
      const example = examples.find(item => item.id === id)!;
      const path = fileURLToPath(new URL(`../../../../fixtures/live/${id}.capture.json`, import.meta.url));
      return await this.replay({ operation: example.operation, capture: await readJsonFile(path) });
    } finally { this.active--; }
  }

  private async discover(input: unknown) {
    const request = DiscoverSchema.parse(input);
    const discovery = await new MorphoDiscovery(this.config.morphoUrl).positions({ owner: request.owner, maxPositions: request.maxPositions });
    const networks = new Map(this.capabilities().networks.map(network => [network.chainId, network]));
    const morphoPositions = discovery.positions.map(position => {
      const network = networks.get(position.chainId)!;
      const v1Ready = position.version === 'v1' && network.resolveV1;
      const v2Ready = position.version === 'v2' && position.chainId === 1
        && position.asset.address === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' && Boolean(this.config.rpcUrl);
      return { ...position, network: network.name, support: v1Ready
        ? { status: 'supported' as const, operation: 'resolve-v1' as const, checkType: 'Vault shares and Morpho market exposure' }
        : v2Ready
          ? { status: 'supported' as const, operation: 'resolve-v2' as const, checkType: 'Nested V2 to V1 market exposure' }
          : { status: 'unsupported' as const, reason: position.version === 'v2'
            ? 'Position found, but this V2 asset or network does not have a safe nested adapter yet.'
            : `${network.name} discovery works, but its RPC is not configured on this deployment.` },
      };
    });
    const registryChecks = await Promise.allSettled((this.config.erc4626Registry ?? []).map(async entry => {
      const rpcUrl = this.rpcForChain(entry.chainId);
      if (!rpcUrl) return null;
      const report = await resolveErc4626Position({ owner: request.owner, vault: entry.vault, chainId: entry.chainId, rpcUrl });
      if (!report.position || BigInt(report.position.sharesRaw) === 0n) return null;
      const network = networks.get(entry.chainId)!;
      return { owner: request.owner, vault: entry.vault, name: entry.name, protocol: entry.protocol,
        version: 'erc4626' as const, chainId: entry.chainId, network: network.name,
        asset: { address: report.position.asset, symbol: report.position.assetSymbol, decimals: report.position.decimals },
        reportedSharesRaw: report.position.sharesRaw, reportedAssetsRaw: report.position.assetsRaw,
        support: { status: 'supported' as const, operation: 'resolve-erc4626' as const,
          checkType: 'ERC-4626 share balance and conversion quote' } };
    }));
    const registryPositions = registryChecks.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
    const registryFailed = registryChecks.some(result => result.status === 'rejected');
    return {
      ...discovery,
      source: registryChecks.length ? 'morpho-graphql+erc4626-registry' : discovery.source,
      scope: registryChecks.length ? 'indexed-morpho-and-configured-erc4626' : discovery.scope,
      complete: discovery.complete && !registryFailed,
      issues: [...discovery.issues, ...(registryFailed ? ['registry-read-failed'] : [])],
      positions: [...morphoPositions, ...registryPositions].slice(0, request.maxPositions),
    };
  }

  private async replay(input: unknown) {
    const request = ReplaySchema.parse(input);
    switch (request.operation) {
      case 'resolve-v1': return replayLiveCapture(request.capture);
      case 'resolve-v2': return replayNestedCapture(request.capture);
      case 'resolve-erc4626': return replayErc4626Capture(request.capture);
      case 'verify-shares': return replayShareVerification(request.capture);
      case 'verify-accounting': return replayAccounting(request.capture);
      case 'verify-weth': return replayCustody(request.capture);
      case 'verify-base-custody': return replayBaseSepoliaCustody(request.capture);
    }
  }

  private async analyze(input: unknown) {
    const request = AnalyzeSchema.parse(input);
    if (!this.capabilities().live[request.operation]) {
      throw new ServiceError(503, 'not-configured', `Configure local providers for ${request.operation} first.`);
    }
    const { rpcUrl, graphUrl, secondaryRpcUrl, expectedDeployment, graphApiKey } = this.config;
    const rpc = { rpcUrl: rpcUrl!, ...(request.blockNumber === undefined ? {} : { blockNumber: request.blockNumber }) };
    const graph = { ...rpc, graphUrl: graphUrl!, ...(expectedDeployment ? { expectedDeployment } : {}) };
    switch (request.operation) {
      case 'resolve-v1': {
        const chainRpc = this.rpcForChain(request.chainId);
        if (!chainRpc) throw new ServiceError(503, 'not-configured', `No RPC is configured for chain ${request.chainId}.`);
        return resolveLivePosition({ rpcUrl: chainRpc, owner: request.owner, vault: request.vault, chainId: request.chainId,
          ...(request.blockNumber === undefined ? {} : { blockNumber: request.blockNumber }) });
      }
      case 'resolve-v2': return resolveNestedPosition({ ...rpc, owner: request.owner, vault: request.vault });
      case 'resolve-erc4626': {
        const chainRpc = this.rpcForChain(request.chainId);
        if (!chainRpc) throw new ServiceError(503, 'not-configured', `No RPC is configured for chain ${request.chainId}.`);
        return resolveErc4626Position({ rpcUrl: chainRpc, owner: request.owner, vault: request.vault, chainId: request.chainId,
          ...(request.blockNumber === undefined ? {} : { blockNumber: request.blockNumber }) });
      }
      case 'verify-shares': return verifyShares({ ...graph, owner: request.owner, vault: request.vault }, graphApiKey);
      case 'verify-accounting': return verifyAccounting({ ...graph, vault: request.vault }, graphApiKey);
      case 'verify-weth': return verifyWethCustody({ ...rpc, owner: request.owner, secondaryRpcUrl: secondaryRpcUrl! });
      case 'verify-base-custody': return verifyBaseSepoliaCustody({
        owner: request.owner,
        deployment: this.config.baseCustodyDeployment!,
        rpcUrl: this.config.baseRpcUrl!,
        secondaryRpcUrl: this.config.baseSecondaryRpcUrl!,
        ...(request.blockNumber === undefined ? {} : { blockNumber: request.blockNumber }),
      });
    }
  }

  private rpcForChain(chainId: number) {
    if (chainId === 1) return this.config.rpcUrl;
    if (chainId === 8453) return this.config.baseMainnetRpcUrl;
    if (chainId === 42161) return this.config.arbitrumRpcUrl;
    if (chainId === 84532) return this.config.baseRpcUrl;
    return undefined;
  }
}
