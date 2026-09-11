import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { verifyBaseSepoliaCustody } from '../../../packages/verification/src/base-sepolia-custody.js';
import type { BaseSepoliaCustodyDeployment } from '../../../packages/verification/src/base-sepolia-custody-capture.js';
import { createBaseSepoliaSimulationSetup } from '../src/base-sepolia-e2e.js';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

const root = resolve(import.meta.dir, '../../..');
const manifestPath = resolve(root, 'deployments/base-sepolia-cre-simulation.json');
const allowlistPath = resolve(root, 'deployments/base-sepolia-cre-simulation-custody.json');
const configPath = resolve(root, '.tare/cre/base-sepolia-simulation.json');
const manifestInput = await readJson(manifestPath);
const manifest = manifestInput as { positionOwner: string };
const deployment = await readJson(allowlistPath) as BaseSepoliaCustodyDeployment;
const report = await verifyBaseSepoliaCustody({
  owner: manifest.positionOwner,
  deployment,
  rpcUrl: process.env.TARE_BASE_RPC_URL ?? 'https://sepolia.base.org',
  secondaryRpcUrl: process.env.TARE_BASE_SECONDARY_RPC_URL ?? 'https://base-sepolia-rpc.publicnode.com',
  timeoutMs: 20000,
});
const setup = createBaseSepoliaSimulationSetup(
  report,
  manifestInput,
  Math.floor(Date.now() / 1000),
  process.env.TARE_CRE_API_URL,
);
await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, `${JSON.stringify(setup.config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(JSON.stringify({
  configPath,
  verification: {
    status: report.status,
    findings: report.findings,
    captureDigest: report.captureDigest,
    multipleMillionths: report.metric.kind === 'available' ? report.metric.multipleMillionths : null,
  },
  approval: setup.approval,
  arm: setup.arm,
}, null, 2));
