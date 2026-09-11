import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, '../../..');
const envPath = resolve(rootDirectory, '.env');
const deploymentArgument = process.argv[2];

if (!deploymentArgument) {
  console.error('Usage: node workflows/cre/scripts/configure-base-deployment.mjs <deployment.json>');
  process.exit(2);
}

try {
  loadEnvFile(envPath);
} catch {
  console.error(`Could not load ${envPath}.`);
  process.exit(1);
}

const deploymentPath = resolve(rootDirectory, deploymentArgument);
let deployment;
try {
  deployment = JSON.parse(await readFile(deploymentPath, 'utf8'));
} catch {
  console.error(`Could not read deployment JSON at ${deploymentPath}.`);
  process.exit(1);
}

const address = /^0x[0-9a-fA-F]{40}$/;
const digest = /^sha256:[0-9a-f]{64}$/;
if (!address.test(deployment.outerVault)
  || !address.test(deployment.innerVault)
  || !address.test(deployment.terminalAsset)
  || !digest.test(deployment.codeDigests?.outerVault)
  || !digest.test(deployment.codeDigests?.innerVault)
  || !digest.test(deployment.codeDigests?.terminalAsset)) {
  console.error('Deployment JSON does not contain the required addresses and SHA-256 code digests.');
  process.exit(1);
}

let contents = await readFile(envPath, 'utf8');
const newline = contents.includes('\r\n') ? '\r\n' : '\n';
const normalized = {
  outerVault: deployment.outerVault.toLowerCase(),
  innerVault: deployment.innerVault.toLowerCase(),
  terminalAsset: deployment.terminalAsset.toLowerCase(),
  codeDigests: deployment.codeDigests,
};
const line = `TARE_BASE_CUSTODY_DEPLOYMENT='${JSON.stringify(normalized)}'`;
const pattern = /^TARE_BASE_CUSTODY_DEPLOYMENT=.*$/m;
if (pattern.test(contents)) contents = contents.replace(pattern, line);
else {
  if (contents.length > 0 && !contents.endsWith('\n')) contents += newline;
  contents += `${line}${newline}`;
}
await writeFile(envPath, contents, { encoding: 'utf8', mode: 0o600 });
console.log(`Selected Base Sepolia custody deployment from ${deploymentArgument}`);
console.log(`Outer vault: ${normalized.outerVault}`);
