import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { baseSepoliaCustodyEvidence } from '../packages/policy/src/base-sepolia.js';
import { word } from '../packages/sources/src/evm.js';
import { BaseSepoliaCustodyCaptureSchema } from '../packages/verification/src/base-sepolia-custody-capture.js';
import { replayBaseSepoliaCustody, verifyBaseSepoliaCustody } from '../packages/verification/src/base-sepolia-custody.js';
import { json, withServer } from './helpers/http.js';
import { baseBlock, baseOwner, baseOuterVault, baseSepoliaCapture, baseTerminalAsset } from './helpers/base-sepolia.js';

const RpcRequest = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) });
function rpcHandler() {
  const evidence = baseSepoliaCapture();
  const witness = evidence.witnesses[0];
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

test('Base Sepolia custody replay produces a recorded 2x control but cannot become live evidence', async () => {
  const report = await replayBaseSepoliaCustody(baseSepoliaCapture());
  assert.equal(report.status, 'matched');
  assert.deepEqual(report.metric, {
    kind: 'available', scope: 'base-sepolia-two-layer-control', terminalAsset: baseTerminalAsset,
    numeratorRaw: '200', denominatorRaw: '100', multipleMillionths: '2000000',
  });
  const evidence = baseSepoliaCustodyEvidence(report, { owner: baseOwner, vault: baseOuterVault });
  assert.equal(evidence.live, false);
  assert.equal(evidence.complete, false);
  assert.equal(evidence.backingVerified, false);
});

test('live two-provider Base Sepolia custody becomes executable evidence only when identities and code agree', async () => {
  await withServer(rpcHandler(), async firstUrl => {
    await withServer(rpcHandler(), async secondUrl => {
      const options = { owner: baseOwner, deployment: baseSepoliaCapture().deployment,
        rpcUrl: firstUrl, secondaryRpcUrl: secondUrl.replace('127.0.0.1', 'localhost') };
      const report = await verifyBaseSepoliaCustody(options);
      const evidence = baseSepoliaCustodyEvidence(report, { owner: baseOwner, vault: baseOuterVault });
      assert.equal(report.status, 'matched');
      assert.deepEqual(evidence, {
        chainId: 84532, owner: baseOwner, vault: baseOuterVault, blockNumber: '99',
        blockHash: baseBlock.hash, blockTimestamp: '1000', live: true, complete: true,
        backingVerified: true, largestMarketBps: null, multiple: { numerator: '200', denominator: '100' },
      });

    });
  });
});

test('Base Sepolia producer suppresses altered code, custody disagreement and substituted identities', async () => {
  const wrongCode = baseSepoliaCapture();
  wrongCode.witnesses[0].codes[0]!.code = '0x6009';
  assert.deepEqual((await replayBaseSepoliaCustody(wrongCode)).findings, ['outerVault-code-mismatch']);

  const disagreement = baseSepoliaCapture();
  disagreement.witnesses[1].rpc.calls.find(call => call.to === baseTerminalAsset)!.result = `0x${word(99n)}`;
  assert.deepEqual((await replayBaseSepoliaCustody(disagreement)).findings, ['provider-disagreement']);

  const report = { ...await replayBaseSepoliaCustody(baseSepoliaCapture()), sourceMode: 'live-rpc' as const };
  assert.equal(baseSepoliaCustodyEvidence(report, { owner: `0x${'55'.repeat(20)}`, vault: baseOuterVault }).complete, false);
  const substituted = baseSepoliaCapture();
  substituted.witnesses[0].codes[0]!.address = `0x${'55'.repeat(20)}`;
  assert.throws(() => BaseSepoliaCustodyCaptureSchema.parse(substituted), /Unexpected code observation/);
});

test('Base producer requires two different RPC hosts', async () => {
  const deployment = baseSepoliaCapture().deployment;
  await assert.rejects(verifyBaseSepoliaCustody({ owner: baseOwner, deployment,
    rpcUrl: 'http://127.0.0.1:8545', secondaryRpcUrl: 'http://127.0.0.1:9545' }), /different RPC hostnames/);
});
