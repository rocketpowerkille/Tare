/** Reviewed allowlist, not discovery by token symbol. See docs/CHAINLINK_COVERAGE.md. */
export interface ChainlinkAsset {
  readonly chainId: 1 | 8453 | 42161;
  readonly asset: string;
  readonly symbol: 'USDC' | 'WETH';
  readonly assetDecimals: 6 | 18;
  readonly feed: 'USDC/USD' | 'ETH/USD';
  readonly proxy: string;
  readonly maxAgeSeconds: number;
}

export const CHAINLINK_ASSETS: readonly ChainlinkAsset[] = Object.freeze([
  { chainId: 1, asset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', assetDecimals: 6,
    feed: 'USDC/USD', proxy: '0x8fffffd4afb6115b954bd326cbe7b4ba576818f6', maxAgeSeconds: 86400 },
  { chainId: 1, asset: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', assetDecimals: 18,
    feed: 'ETH/USD', proxy: '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419', maxAgeSeconds: 3600 },
  { chainId: 8453, asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', assetDecimals: 6,
    feed: 'USDC/USD', proxy: '0x7e860098f58bbfc8648a4311b374b1d669a2bc6b', maxAgeSeconds: 86400 },
  { chainId: 8453, asset: '0x4200000000000000000000000000000000000006', symbol: 'WETH', assetDecimals: 18,
    feed: 'ETH/USD', proxy: '0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70', maxAgeSeconds: 1200 },
  { chainId: 42161, asset: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', symbol: 'USDC', assetDecimals: 6,
    feed: 'USDC/USD', proxy: '0x50834f3163758fcc1df9973b6e91f0f0f0434ad3', maxAgeSeconds: 255 },
  { chainId: 42161, asset: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', symbol: 'WETH', assetDecimals: 18,
    feed: 'ETH/USD', proxy: '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612', maxAgeSeconds: 1755 },
].map(entry => Object.freeze(entry)) as ChainlinkAsset[]);

export function supportedChainlinkAsset(chainId: number, asset: string) {
  return CHAINLINK_ASSETS.find(entry => entry.chainId === chainId && entry.asset === asset.toLowerCase());
}

export const SEQUENCER_FEEDS: Readonly<Record<number, string>> = Object.freeze({
  8453: '0xbcf85224fc0756b9fa45aa7892530b47e10b6433',
  42161: '0xfdb631f5ee196f0ed6faa767959853a9f217697d',
});
export const SEQUENCER_GRACE_SECONDS = 3600;
