import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TareService, configFromEnv } from '../packages/service/src/index.js';
import { BaseSepoliaCustodyDeploymentSchema } from '../packages/verification/src/base-sepolia-custody-capture.js';
import { runCli } from './helpers/cli.js';
import { baseBlock, baseOwner, baseSepoliaCapture } from './helpers/base-sepolia.js';
import { json, withServer } from './helpers/http.js';
import { z } from 'zod/v4';

const RpcRequest = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) });
function rpcHandler() {
  const witness = baseSepoliaCapture().witnesses[0];
  return (body: unknown, response: Parameters<typeof json>[0]) => {
    const request = RpcRequest.parse(body);
    let result: unknown;
    if (request.method === 'eth_chainId') result = '0x14a34';
    else if (request.method === 'eth_getBlockByNumber') result = baseBlock;
    else if (request.method === 'eth_getCode') {
      const address = z.string().parse(request.params[0]).toLowerCase();
      result = witness.codes.find(item => item.address === address)?.code;
    } else if (request.method === 'eth_call') {
      const call = z.object({ to: z.string(), data: z.string() }).parse(request.params[0]);
      result = witness.rpc.calls.find(item => item.to === call.to.toLowerCase() && item.data === call.data.toLowerCase())?.result;
    }
    assert.notEqual(result, undefined, `Unhandled ${request.method} fixture request`);
    json(response, { jsonrpc: '2.0', id: request.id, result });
  };
}

test('protected service exposes the configured Base producer without accepting deployment input', async () => {
  await withServer(rpcHandler(), async firstUrl => {
    await withServer(rpcHandler(), async secondUrl => {
      const service = new TareService({ baseRpcUrl: firstUrl,
        baseSecondaryRpcUrl: secondUrl.replace('127.0.0.1', 'localhost'),
        baseCustodyDeployment: BaseSepoliaCustodyDeploymentSchema.parse(baseSepoliaCapture().deployment) });
      assert.equal(service.capabilities().live['verify-base-custody'], true);
      const served = await service.run('analyze', { operation: 'verify-base-custody', owner: baseOwner });
      assert.equal((served as { status: string }).status, 'matched');
      await assert.rejects(service.run('analyze', { operation: 'verify-base-custody', owner: baseOwner,
        deployment: baseSepoliaCapture().deployment }));
    });
  });
});

test('Base deployment environment is private and validated', () => {
  const deployment = baseSepoliaCapture().deployment;
  const config = configFromEnv({ TARE_BASE_RPC_URL: 'https://base-a.invalid/SECRET',
    TARE_BASE_SECONDARY_RPC_URL: 'https://base-b.invalid/SECRET',
    TARE_BASE_CUSTODY_DEPLOYMENT: JSON.stringify(deployment) });
  assert.deepEqual(config.baseCustodyDeployment, deployment);
  assert.throws(() => configFromEnv({ TARE_BASE_CUSTODY_DEPLOYMENT: '{}' }), /valid allowlisted deployment/);
});

test('Base custody capture replays through the public CLI without claiming live evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tare-base-custody-'));
  const path = join(directory, 'capture.json');
  try {
    await writeFile(path, JSON.stringify(baseSepoliaCapture()));
    const result = await runCli(['verify', 'base-custody-replay', path, '--json']);
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(result.stdout) as { sourceMode: string; status: string };
    assert.equal(report.sourceMode, 'recorded-rpc');
    assert.equal(report.status, 'matched');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
