import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, '../../..');
const envPath = resolve(rootDirectory, '.env');

try {
  loadEnvFile(envPath);
} catch {
  console.error(`Could not load ${envPath}.`);
  process.exit(1);
}

const apiUrl = process.env.TARE_CRE_API_URL;
let parsedApiUrl;
try {
  parsedApiUrl = new URL(apiUrl);
} catch {
  console.error('TARE_CRE_API_URL must be configured in .env.');
  process.exit(1);
}
if (parsedApiUrl.protocol !== 'https:' || parsedApiUrl.pathname !== '/api/analyze'
  || parsedApiUrl.search || parsedApiUrl.hash) {
  console.error('TARE_CRE_API_URL must be an HTTPS /api/analyze endpoint.');
  process.exit(1);
}

const manifest = JSON.parse(await readFile(
  resolve(rootDirectory, 'deployments/base-sepolia-cre-simulation.json'),
  'utf8',
));
const config = {
  schedule: '0 */5 * * * *',
  evidenceSource: 'base-sepolia-custody',
  apiUrl: parsedApiUrl.href,
  owner: manifest.positionOwner,
  vault: manifest.contracts.outerVault,
  graphDeployment: 'not-used-for-base-sepolia',
  policySecretId: 'TARE_PRIVATE_POLICY',
  apiSecretId: 'TARE_API_TOKEN',
  execution: {
    enabled: false,
    receiver: '0x0000000000000000000000000000000000000000',
    shares: '0',
    minAssets: '0',
    nonce: '0',
    validUntil: '0',
  },
};

const outputPath = resolve(rootDirectory, '.tare/cre/base-sepolia-hosted.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(JSON.stringify({
  configPath: outputPath,
  apiUrl: config.apiUrl,
  evidenceSource: config.evidenceSource,
  owner: config.owner,
  vault: config.vault,
  executionEnabled: config.execution.enabled,
}, null, 2));
