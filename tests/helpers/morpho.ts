import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { z } from 'zod/v4';
import { CaptureSchema } from '../../packages/domain/src/live.js';
import type { LiveCapture } from '../../packages/domain/src/live.js';
import { json } from './http.js';
import type { Handler } from './http.js';

export const capturePath = 'fixtures/live/steakhouse-usdc.capture.json';
export const fixture = async (): Promise<LiveCapture> => CaptureSchema.parse(JSON.parse(await readFile(capturePath, 'utf8')));
const RpcRequest = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) });
export function replayHandler(capture: LiveCapture, mutate?: (call: z.infer<typeof RpcRequest>, response: ServerResponse) => boolean): Handler {
  return (body, response) => {
    if (typeof body === 'object' && body !== null && 'query' in body) { json(response, { data: { vaultByAddress: capture.metadata } }); return; }
    const call = RpcRequest.parse(body);
    if (mutate?.(call, response)) return;
    if (call.method === 'eth_chainId') { json(response, { jsonrpc: '2.0', id: call.id, result: '0x1' }); return; }
    if (call.method === 'eth_getBlockByNumber') { json(response, { jsonrpc: '2.0', id: call.id, result: capture.block }); return; }
    assert.equal(call.method, 'eth_call', 'Only read methods may be used');
    assert.deepEqual(call.params[1], { blockHash: capture.block?.hash, requireCanonical: true });
    const tx = z.object({ to: z.string(), data: z.string() }).parse(call.params[0]);
    const found = capture.observations.find(item => item.to === tx.to && item.data === tx.data);
    assert.ok(found, `Unrecorded call ${tx.data}`);
    json(response, { jsonrpc: '2.0', id: call.id, result: found.result });
  };
}
