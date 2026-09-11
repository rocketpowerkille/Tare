import { loadEnvFile } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const originArgument = process.argv[2];

if (!originArgument) {
  console.error('Usage: npm run configure:origin --prefix workflows/cre -- https://<host>');
  process.exit(2);
}

let origin;
try {
  const url = new URL(originArgument);
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('invalid public origin');
  }
  origin = url.origin;
} catch {
  console.error('Expected an exact HTTPS origin such as https://tare-api.onrender.com');
  process.exit(2);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDirectory, '../../..', '.env');
let contents;
try {
  contents = await readFile(envPath, 'utf8');
  loadEnvFile(envPath);
} catch {
  console.error(`Missing or invalid ${envPath}; copy .env.example to .env first.`);
  process.exit(1);
}

let keys;
try {
  keys = JSON.parse(process.env.TARE_API_KEYS ?? '');
} catch {
  console.error('TARE_API_KEYS must be valid JSON.');
  process.exit(1);
}

const secretToken = process.env.SECRET_TARE_API_TOKEN;
if (typeof keys.cre !== 'string' || !secretToken || keys.cre !== secretToken) {
  console.error('The existing CRE API key and SECRET_TARE_API_TOKEN must match before changing origins.');
  process.exit(1);
}

const newline = contents.includes('\r\n') ? '\r\n' : '\n';
const settings = new Map([
  ['TARE_PUBLIC_ORIGIN', origin],
  ['TARE_CRE_API_URL', `${origin}/api/analyze`],
]);

for (const [name, value] of settings) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(contents)) {
    contents = contents.replace(pattern, line);
  } else {
    if (contents.length > 0 && !contents.endsWith('\n')) contents += newline;
    contents += `${line}${newline}`;
  }
}

await writeFile(envPath, contents, { encoding: 'utf8', mode: 0o600 });
console.log(`Configured the stable Tare origin at ${origin}`);
console.log('Existing API and CRE tokens were validated and preserved.');
