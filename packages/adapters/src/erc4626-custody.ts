import { readUint } from './morpho-blue.js';
import { decodeAddress, settleReads, word } from '../../sources/src/evm.js';
import type { ContractReader } from '../../sources/src/evm.js';

export const ERC4626_SELECTOR = {
  asset: '0x38d52e0f',
  totalSupply: '0x18160ddd',
  totalAssets: '0x01e1d114',
  balanceOf: '0x70a08231',
  previewRedeem: '0x4cdad506',
} as const;

export interface TwoLayerCustodyDeployment {
  outerVault: string;
  innerVault: string;
  terminalAsset: string;
}

/** Exact ERC-4626 read set shared by allowlisted two-layer testnet controls. */
export async function readTwoLayerCustody(
  reader: ContractReader,
  deployment: TwoLayerCustodyDeployment,
  owner: string,
) {
  const outerAsset = decodeAddress(await reader.call(deployment.outerVault, ERC4626_SELECTOR.asset));
  const [ownerShares, outerSupply, outerAssets, outerCustodyShares] = await settleReads([
    readUint(reader, deployment.outerVault, ERC4626_SELECTOR.balanceOf, word(owner)),
    readUint(reader, deployment.outerVault, ERC4626_SELECTOR.totalSupply),
    readUint(reader, deployment.outerVault, ERC4626_SELECTOR.totalAssets),
    readUint(reader, deployment.innerVault, ERC4626_SELECTOR.balanceOf, word(deployment.outerVault)),
  ]);
  const ownerInnerShares = await readUint(
    reader,
    deployment.outerVault,
    ERC4626_SELECTOR.previewRedeem,
    word(ownerShares!),
  );
  const innerAsset = decodeAddress(await reader.call(deployment.innerVault, ERC4626_SELECTOR.asset));
  const [innerSupply, innerAssets, terminalCustody, ownerTerminalAssets] = await settleReads([
    readUint(reader, deployment.innerVault, ERC4626_SELECTOR.totalSupply),
    readUint(reader, deployment.innerVault, ERC4626_SELECTOR.totalAssets),
    readUint(reader, deployment.terminalAsset, ERC4626_SELECTOR.balanceOf, word(deployment.innerVault)),
    readUint(reader, deployment.innerVault, ERC4626_SELECTOR.previewRedeem, word(ownerInnerShares)),
  ]);
  return {
    outerAsset,
    innerAsset,
    ownerShares: ownerShares!.toString(),
    outerSupply: outerSupply!.toString(),
    outerAssets: outerAssets!.toString(),
    outerCustodyShares: outerCustodyShares!.toString(),
    ownerInnerShares: ownerInnerShares.toString(),
    innerSupply: innerSupply!.toString(),
    innerAssets: innerAssets!.toString(),
    terminalCustody: terminalCustody!.toString(),
    ownerTerminalAssets: ownerTerminalAssets!.toString(),
  };
}
