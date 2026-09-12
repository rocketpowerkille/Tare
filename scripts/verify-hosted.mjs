import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const originArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const origin = new URL(originArgument ?? 'https://tare-api.onrender.com');
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error('Hosted verification requires a plain HTTPS origin.');
}

const token = process.env.TARE_API_TOKEN ?? process.env.SECRET_TARE_API_TOKEN;
if (!token) throw new Error('Set TARE_API_TOKEN or SECRET_TARE_API_TOKEN before hosted verification.');
const verifyLiveGraph = process.argv.includes('--live-graph');

async function response(path, init = {}) {
  const result = await fetch(new URL(path, origin), {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(120_000),
  });
  if (!result.ok) throw new Error(`${path} returned HTTP ${result.status}.`);
  return result;
}

for (const path of ['/', '/explore', '/docs', '/developers']) {
  const result = await response(path);
  if (!result.headers.get('content-type')?.startsWith('text/html')) throw new Error(`${path} did not return HTML.`);
  const html = await result.text();
  if (!html.includes('<div id="root"></div>')) throw new Error(`${path} did not return the React application shell.`);
  console.log(`${path} ok`);
}

const health = await (await response('/healthz')).json();
if (health.status !== 'ok') throw new Error('Hosted health response is invalid.');
console.log('/healthz ok');

const headers = { Authorization: `Bearer ${token}` };
const capabilities = await (await response('/api/status', { headers })).json();
if (capabilities.name !== 'tare' || capabilities.readOnly !== true) throw new Error('Hosted capability response is invalid.');
console.log('/api/status ok');

const example = await (await response('/api/agent-example', {
  method: 'POST',
  headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify({ id: 'steakhouse-usdc' }),
})).json();
if (example.sourceMode !== 'recorded-rpc' || example.captureOmitted !== true) {
  throw new Error('Hosted compact example did not preserve its recorded-evidence boundary.');
}
console.log('/api/agent-example ok');

if (verifyLiveGraph) {
  const graphContract = await (await response('/openapi-graph.json')).json();
  if (graphContract.servers?.[0]?.url !== 'https://api.studio.thegraph.com'
    || !graphContract.paths?.['/query/1760123/tare-live-accounting/0.1.0']) {
    throw new Error('Hosted The Graph gateway contract is invalid.');
  }
  console.log('/openapi-graph.json ok');

  const accounting = await (await response('/api/agent-analyze', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      operation: 'verify-accounting',
      vault: '0xbeef01735c132ada46aa9aa4c54623caa92a64cb',
    }),
  })).json();
  if (accounting.sourceMode !== 'live-graph-rpc' || accounting.status !== 'matched'
    || accounting.verification !== 'underlying-accounting-cross-check-only'
    || !Array.isArray(accounting.checks) || accounting.checks.length !== 56
    || !Array.isArray(accounting.findings) || accounting.findings.length !== 0) {
    const details = {
      sourceMode: accounting.sourceMode,
      status: accounting.status,
      checks: Array.isArray(accounting.checks) ? accounting.checks.length : null,
      findings: Array.isArray(accounting.findings) ? accounting.findings : null,
    };
    throw new Error(`Hosted Graph and RPC accounting acceptance failed: ${JSON.stringify(details)}`);
  }
  console.log('/api/agent-analyze live Graph/RPC accounting ok');
}
console.log(`Hosted Tare acceptance passed at ${origin.origin}.`);
