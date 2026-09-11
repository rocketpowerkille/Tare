import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { verifyShares } from '../../dist/packages/verification/src/shares.js';
import { verifyAccounting } from '../../dist/packages/verification/src/accounting.js';
import { word } from '../../dist/packages/sources/src/evm.js';

// All transactions are sent to this isolated Anvil instance, never a configurable RPC.
const rpcUrl = 'http://127.0.0.1:18545';
const subgraphName = `tare/control-${Date.now()}`;
const graphUrl = `http://127.0.0.1:18000/subgraphs/name/${subgraphName}`;
const adminUrl = 'http://127.0.0.1:18020';
let id = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert(!result.error, JSON.stringify(result.error));
  return result.result;
}
async function waitUntil(check, label) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function indexed(block) {
  await waitUntil(async () => {
    const response = await fetch(graphUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{_meta{block{number hash} hasIndexingErrors}}' }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    assert(!result.data?._meta?.hasIndexingErrors, 'Graph indexing failed');
    return result.data?._meta?.block.hash === block.hash;
  }, `Graph block ${block.number}/${block.hash}`);
}
await waitUntil(async () => {
  try { return (await fetch(adminUrl, { signal: AbortSignal.timeout(2000) })).status < 500; }
  catch { return false; }
}, 'Graph admin readiness');
const accounts = await rpc('eth_accounts');
assert.equal(await rpc('eth_chainId'), '0x1');
assert.match(await rpc('web3_clientVersion'), /anvil/i);
const owner = accounts[0];
const artifact = async name => JSON.parse(await readFile(new URL(`out/IndexingControl.sol/${name}.json`, import.meta.url), 'utf8'));
const blue = await artifact('BlueControl');
await rpc('anvil_setCode', ['0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb', blue.deployedBytecode.object]);
const control = await artifact('IndexingControl');
const tx = await rpc('eth_sendTransaction', [{ from: owner, data: control.bytecode.object, gas: '0x300000' }]);
const deployed = await rpc('eth_getTransactionReceipt', [tx]);
assert.equal(deployed.status, '0x1');
const vault = deployed.contractAddress;
const transact = async data => {
  const hash = await rpc('eth_sendTransaction', [{ from: owner, to: vault, data, gas: '0x100000' }]);
  assert.equal((await rpc('eth_getTransactionReceipt', [hash])).status, '0x1');
  return rpc('eth_getBlockByNumber', ['latest', false]);
};
await transact('0x40c10f19' + word(owner) + word(100n));
const directory = fileURLToPath(new URL('../subgraph/', import.meta.url));
const manifest = (await readFile(new URL('../subgraph/subgraph.yaml', import.meta.url), 'utf8'))
  .replaceAll('0xbeef01735c132ada46aa9aa4c54623caa92a64cb', vault)
  .replace('startBlock: 18928285', `startBlock: ${Number(BigInt(deployed.blockNumber))}`)
  .replace("data: '18928285'", `data: '${BigInt(deployed.blockNumber)}'`)
  .replace('startBlock: 25937756', `startBlock: ${Number(BigInt(deployed.blockNumber))}`);
await writeFile(new URL('../subgraph/subgraph.local.yaml', import.meta.url), manifest);
const cli = fileURLToPath(new URL('../subgraph/node_modules/@graphprotocol/graph-cli/bin/run.js', import.meta.url));
const runGraph = (...args) => promisify(execFile)(process.execPath, [cli, ...args], { cwd: directory, timeout: 120000 });
await runGraph('create', subgraphName, '--node', adminUrl);
await runGraph('deploy', subgraphName, 'subgraph.local.yaml', '--node', adminUrl,
  '--ipfs', 'http://127.0.0.1:15001', '--version-label', 'local-control');
console.log('Deployed local control and actual WASM mappings');
const check = async (block, head = block) => {
  await indexed(head);
  const blockNumber = BigInt(block.number).toString();
  const shares = await verifyShares({ owner, vault, rpcUrl, graphUrl, blockNumber });
  const accounting = await verifyAccounting({ vault, rpcUrl, graphUrl, blockNumber });
  assert.equal(shares.status, 'matched', JSON.stringify(shares.findings));
  assert.equal(accounting.status, 'matched', JSON.stringify(accounting.findings));
  return { shares, accounting };
};
const initial = await check(await rpc('eth_getBlockByNumber', ['latest', false]));
console.log('Share ledger and underlying accounting agree');
const snapshot = await rpc('evm_snapshot');
const orphan = await transact('0xa9059cbb' + word(accounts[1]) + word(30n));
await check(orphan);
assert.equal(await rpc('evm_revert', [snapshot]), true);
const replacement = await transact('0x42966c68' + word(20n));
assert.equal(replacement.number, orphan.number);
assert.notEqual(replacement.hash, orphan.hash);
// Advance the head so Graph Node's poller discovers the competing branch.
await rpc('evm_mine');
const final = await check(replacement, await rpc('eth_getBlockByNumber', ['latest', false]));
assert.equal(final.shares.checks.find(check => check.field === 'owner-shares').rpc, '80');
assert.equal(final.shares.checks.find(check => check.field === 'total-shares').rpc, '80');
const orphanBalance = await (await fetch(graphUrl, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: `query($id:ID!){accountBalance(id:$id){shares}}`, variables: { id: `${vault}-${accounts[1]}` } }),
  signal: AbortSignal.timeout(10000),
})).json();
assert.equal(orphanBalance.data.accountBalance, null, 'Orphan recipient balance must be rolled back');
const result = { origin: 'local-anvil-control', initial, orphan: { number: orphan.number, hash: orphan.hash }, final };
await writeFile(new URL('result.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log('Graph Node rolled back the orphan transfer and indexed the replacement burn; 80/80 shares');
