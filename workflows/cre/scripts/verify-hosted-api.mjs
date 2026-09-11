import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, '../../..');
const envPath = resolve(rootDirectory, '.env');

try {
  loadEnvFile(envPath);
} catch {
  console.error(`Could not load ${envPath}.`);
  process.exit(1);
}

const origin = process.env.TARE_PUBLIC_ORIGIN;
const token = process.env.SECRET_TARE_API_TOKEN;
if (!origin || !token) {
  console.error('TARE_PUBLIC_ORIGIN and SECRET_TARE_API_TOKEN must be configured in .env.');
  process.exit(1);
}

let keys;
try {
  keys = JSON.parse(process.env.TARE_API_KEYS ?? '');
} catch {
  console.error('TARE_API_KEYS must be valid JSON.');
  process.exit(1);
}
if (keys.cre !== token) {
  console.error('The CRE API key and SECRET_TARE_API_TOKEN do not match.');
  process.exit(1);
}

const manifest = JSON.parse(await readFile(
  resolve(rootDirectory, 'deployments/base-sepolia-cre-simulation.json'),
  'utf8',
));
const options = {
  signal: AbortSignal.timeout(90000),
  headers: { authorization: `Bearer ${token}` },
};

const anonymous = await fetch(`${origin}/api/status`, { signal: options.signal });
if (anonymous.status !== 401) {
  throw new Error(`Anonymous API request returned ${anonymous.status}; expected 401.`);
}

const statusResponse = await fetch(`${origin}/api/status`, options);
if (!statusResponse.ok) throw new Error(`Authenticated status request returned ${statusResponse.status}.`);
const status = await statusResponse.json();
if (status.live?.['verify-base-custody'] !== true) {
  throw new Error('Hosted API does not advertise live Base Sepolia custody verification.');
}

const evidenceResponse = await fetch(`${origin}/api/analyze`, {
  ...options,
  method: 'POST',
  headers: { ...options.headers, 'content-type': 'application/json' },
  body: JSON.stringify({ operation: 'verify-base-custody', owner: manifest.positionOwner }),
});
if (!evidenceResponse.ok) {
  throw new Error(`Hosted evidence request returned ${evidenceResponse.status}.`);
}
const evidence = await evidenceResponse.json();

console.log(JSON.stringify({
  origin,
  anonymousStatus: anonymous.status,
  authenticatedStatus: statusResponse.status,
  baseSepolia: {
    status: evidence.status,
    findings: evidence.findings,
    captureDigest: evidence.captureDigest,
    multipleMillionths: evidence.metric?.kind === 'available'
      ? evidence.metric.multipleMillionths
      : null,
  },
}, null, 2));
