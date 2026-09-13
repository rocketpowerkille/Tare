import { supportedChainlinkAsset } from './chainlink-feeds.js';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as RecordValue : {};

/** A fresh quote must retain its identity and block. Never reprice a saved report as fresh. */
export function positionValuationInput(report: RecordValue, input: { operation: string; chainId?: number }) {
  const chainId = input.chainId ?? 1;
  if (!['resolve-v1', 'resolve-erc4626'].includes(input.operation) || report.sourceMode !== 'live-rpc'
    || report.chainId !== chainId || !['complete', 'partial'].includes(String(report.status ?? report.kind))) return undefined;
  const position = object(input.operation === 'resolve-v1' ? report.vault : report.position);
  const asset = typeof position.asset === 'string' ? supportedChainlinkAsset(chainId, position.asset) : undefined;
  const amountRaw = input.operation === 'resolve-v1' ? position.convertToAssetsRaw : position.assetsRaw;
  if (!asset || position.decimals !== asset.assetDecimals || typeof amountRaw !== 'string'
    || !/^(0|[1-9][0-9]{0,77})$/.test(amountRaw) || BigInt(amountRaw) >= 2n ** 256n) return undefined;
  const capture = object(report.capture);
  const rpc = object(capture.rpc);
  const block = object(capture.block ?? rpc.block);
  if (capture.blockConfirmed !== true && rpc.confirmed !== true) return undefined;
  if (typeof block.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) return undefined;
  if (typeof block.number !== 'string' || !/^(0x[0-9a-fA-F]{1,64}|[0-9]{1,78})$/.test(block.number)
    || BigInt(block.number) >= 2n ** 256n) return undefined;
  return { chainId: asset.chainId, asset: asset.asset, amountRaw, assetDecimals: asset.assetDecimals,
    blockNumber: BigInt(block.number).toString(), blockHash: block.hash.toLowerCase() };
}
