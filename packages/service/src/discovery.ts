import { MorphoDiscovery } from '../../sources/src/morpho.js';
import { resolveErc4626Position } from '../../resolver/src/erc4626.js';
import { EulerDiscovery } from '../../sources/src/euler.js';
import { DiscoverSchema } from './requests.js';
import type { ServiceConfig } from './index.js';

interface Network { chainId: number; name: string; resolveV1: boolean; erc4626: boolean }

export async function discoverPositions(input: unknown, config: Readonly<ServiceConfig>, networkList: Network[], rpcForChain: (chainId: number) => string | undefined) {
  const request = DiscoverSchema.parse(input);
  const [discovery, euler] = await Promise.all([
    new MorphoDiscovery(config.morphoUrl).positions({ owner: request.owner, maxPositions: request.maxPositions }),
    config.eulerUrl ? new EulerDiscovery(config.eulerUrl, config.eulerMetadataUrl).positions(request.owner)
      .catch(() => ({ positions: [], issues: ['euler-unavailable'] })) : undefined,
  ]);
  const networks = new Map(networkList.map(network => [network.chainId, network]));
  const morphoPositions = discovery.positions.map(position => {
    const network = networks.get(position.chainId)!;
    const v1Ready = position.version === 'v1' && network.resolveV1;
    const v2Ready = position.version === 'v2' && position.chainId === 1
      && position.asset.address === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' && Boolean(config.rpcUrl);
    // V2 exposes ERC-4626 reads even where its strategy adapters cannot be traced.
    // Offer that narrower operation explicitly, without changing nested support.
    const v2AccountingReady = position.version === 'v2' && network.erc4626;
    return { ...position, network: network.name, support: v1Ready
      ? { status: 'supported' as const, operation: 'resolve-v1' as const, checkType: 'Vault shares and Morpho market exposure' }
      : v2Ready
        ? { status: 'supported' as const, operation: 'resolve-v2' as const, checkType: 'Nested V2 to V1 market exposure' }
        : v2AccountingReady
          ? { status: 'supported' as const, operation: 'resolve-erc4626' as const,
            checkType: 'Accounting only: wallet shares and asset conversion quote. V2 strategy allocations are not traced.' }
          : { status: 'unsupported' as const,
            reason: `${network.name} discovery works, but its RPC is not configured on this deployment.` },
    };
  });
  const registryChecks = await Promise.allSettled((config.erc4626Registry ?? []).map(async entry => {
    const rpcUrl = rpcForChain(entry.chainId);
    if (!rpcUrl) throw new Error('Registry chain RPC is not configured');
    const report = await resolveErc4626Position({ owner: request.owner, vault: entry.vault, chainId: entry.chainId, rpcUrl });
    if (report.kind !== 'complete' || !report.position) throw new Error('Registry read was incomplete');
    if (BigInt(report.position.sharesRaw) === 0n) return null;
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
  const eulerPositions = (euler?.positions ?? []).map(position => {
    const network = networks.get(position.chainId)!;
    return { ...position, network: network.name, support: network.erc4626
      ? { status: 'supported' as const, operation: 'resolve-erc4626' as const,
        checkType: 'ERC-4626 supply shares and conversion; Euler debt and subaccounts are not assessed' }
      : { status: 'unsupported' as const, reason: `${network.name} RPC is not configured on this deployment.` } };
  });
  // Interleave sources so a long Morpho list cannot hide every other protocol.
  const seen = new Set<string>();
  const groups = [morphoPositions, eulerPositions, registryPositions].map(group => group.filter(position => {
    const key = `${position.chainId}:${position.vault}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
  const positions = new Map<string, (typeof groups)[number][number]>();
  for (let index = 0; index < Math.max(...groups.map(group => group.length)); index++) {
    for (const group of groups) {
      const position = group[index];
      if (position && !positions.has(`${position.chainId}:${position.vault}`)) positions.set(`${position.chainId}:${position.vault}`, position);
    }
  }
  const issues = [...new Set([...discovery.issues, ...(euler?.issues ?? []),
    ...(registryFailed ? ['registry-read-failed'] : []), ...(positions.size > request.maxPositions ? ['limit'] : [])])];
  return {
    ...discovery,
    source: euler ? 'multi-protocol' : registryChecks.length ? 'morpho-graphql+erc4626-registry' : discovery.source,
    scope: euler ? 'indexed-morpho-euler-and-configured-erc4626' : registryChecks.length ? 'indexed-morpho-and-configured-erc4626' : discovery.scope,
    complete: issues.length === 0,
    issues,
    positions: [...positions.values()].slice(0, request.maxPositions),
  };
}
