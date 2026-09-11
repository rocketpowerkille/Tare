import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyBaseSepoliaCustody } from '../../../packages/verification/src/base-sepolia-custody.js';
import type { BaseSepoliaCustodyDeployment } from '../../../packages/verification/src/base-sepolia-custody-capture.js';
import { createBaseSepoliaExitPlan } from '../src/base-sepolia-e2e.js';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

const root = resolve(import.meta.dir, '../../..');
const manifestInput = await readJson(resolve(root, 'deployments/base-sepolia-e2e.json'));
const manifest = manifestInput as {
  positionOwner: string;
};
const deployment = await readJson(
  resolve(root, 'deployments/base-sepolia-custody.json'),
) as BaseSepoliaCustodyDeployment;
const report = await verifyBaseSepoliaCustody({
  owner: manifest.positionOwner,
  deployment,
  rpcUrl: process.env.TARE_BASE_RPC_URL ?? 'https://sepolia.base.org',
  secondaryRpcUrl: process.env.TARE_BASE_SECONDARY_RPC_URL ?? 'https://base-sepolia-rpc.publicnode.com',
  timeoutMs: 20000,
});
const plan = createBaseSepoliaExitPlan(
  report,
  manifestInput,
  Math.floor(Date.now() / 1000),
);
console.log(JSON.stringify(plan));
