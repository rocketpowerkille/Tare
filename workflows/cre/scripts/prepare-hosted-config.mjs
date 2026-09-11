import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, '../../..');
const envPath = resolve(rootDirectory, '.env');
const arguments_ = process.argv.slice(2);
if (arguments_.some(value => value !== '--execute') || arguments_.length > 1) {
  console.error('Usage: node workflows/cre/scripts/prepare-hosted-config.mjs [--execute]');
  process.exit(2);
}
const executionEnabled = arguments_.includes('--execute');

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
  resolve(rootDirectory, 'deployments/base-sepolia-hosted.json'),
  'utf8',
));
const address = /^0x[0-9a-fA-F]{40}$/;
const raw = /^(0|[1-9][0-9]{0,77})$/;
const plannedExit = manifest.plannedExit;
if (manifest.chainId !== 84532 || manifest.productionForwarder !== true
  || !address.test(manifest.positionOwner) || !address.test(manifest.contracts?.outerVault)
  || !address.test(manifest.contracts?.receiver) || !raw.test(plannedExit?.sharesRaw)
  || !raw.test(plannedExit?.minAssetsRaw) || !raw.test(plannedExit?.nonce)
  || !Number.isSafeInteger(plannedExit?.permitDurationSeconds)
  || plannedExit.permitDurationSeconds < 600 || plannedExit.permitDurationSeconds > 86400) {
  console.error('Hosted Base Sepolia deployment does not contain a valid bounded exit plan.');
  process.exit(1);
}
const permitValidUntil = String(Math.floor(Date.now() / 1000) + plannedExit.permitDurationSeconds);
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
    enabled: executionEnabled,
    receiver: executionEnabled ? manifest.contracts.receiver : '0x0000000000000000000000000000000000000000',
    shares: executionEnabled ? plannedExit.sharesRaw : '0',
    minAssets: executionEnabled ? plannedExit.minAssetsRaw : '0',
    nonce: executionEnabled ? plannedExit.nonce : '0',
    validUntil: executionEnabled ? permitValidUntil : '0',
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
  ...(executionEnabled ? {
    approval: {
      token: manifest.contracts.outerVault,
      spender: manifest.contracts.receiver,
      shares: plannedExit.sharesRaw,
    },
    arm: {
      receiver: manifest.contracts.receiver,
      vault: manifest.contracts.outerVault,
      shares: plannedExit.sharesRaw,
      minAssets: plannedExit.minAssetsRaw,
      nonce: plannedExit.nonce,
      permitValidUntil,
    },
  } : {}),
}, null, 2));
