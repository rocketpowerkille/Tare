import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const originArgument = process.argv[2];

if (!originArgument) {
  console.error('Usage: node workflows/cre/scripts/configure-hosted-env.mjs https://<name>.trycloudflare.com');
  process.exit(2);
}

let origin;
try {
  const url = new URL(originArgument);
  if (url.protocol !== 'https:'
    || url.hostname === 'trycloudflare.com'
    || !url.hostname.endsWith('.trycloudflare.com')
    || url.username
    || url.password
    || url.port
    || url.pathname !== '/'
    || url.search
    || url.hash) {
    throw new Error('invalid Quick Tunnel origin');
  }
  origin = url.origin;
} catch {
  console.error('Expected an exact HTTPS Quick Tunnel origin such as https://example.trycloudflare.com');
  process.exit(2);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDirectory, '../../..', '.env');
let contents;
try {
  contents = await readFile(envPath, 'utf8');
} catch {
  console.error(`Missing ${envPath}; copy .env.example to .env first.`);
  process.exit(1);
}

const token = randomBytes(32).toString('base64url');
const newline = contents.includes('\r\n') ? '\r\n' : '\n';
const settings = new Map([
  ['TARE_PUBLIC_ORIGIN', origin],
  ['TARE_API_KEYS', `'${JSON.stringify({ cre: token })}'`],
  ['TARE_REQUESTS_PER_MINUTE', '60'],
  ['TARE_CRE_API_URL', `${origin}/api/analyze`],
  ['SECRET_TARE_API_TOKEN', token],
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
console.log(`Configured authenticated Tare access at ${origin}`);
console.log('Generated matching API and CRE secret tokens in the ignored .env file; token value was not printed.');
