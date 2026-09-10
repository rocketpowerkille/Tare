import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { z } from 'zod/v4';
import { applyParams, createAuthInterceptor, createRegistry, createRequest, createSubstream, streamBlocks, unpackMapOutput } from '@substreams/core';
import type { Package, Response } from '@substreams/core/proto';
import { MORPHO_BLUE_ETHEREUM } from '../../adapters/src/morpho-blue.js';
import { Frame, Position } from '../../monitor/src/model.js';
import { validateHttpUrl } from './http.js';

// Match the SDK's CommonJS protobuf/Connect declarations without unsafe transport casts.
const { createGrpcTransport } = createRequire(import.meta.url)('@connectrpc/connect-node') as
  typeof import('@connectrpc/connect-node', { with: { 'resolution-mode': 'require' } });

export const SUBSTREAM_PACKAGE = {
  url: 'https://spkg.io/streamingfast/ethereum-common-v0.3.3.spkg',
  sha256: '67cfcb8f52a65611d80d2fd6ee951ecb77d848ddcbda0eb5aac839e880b1e020',
  module: 'filtered_events',
} as const;

export interface EventPackage { pkg: Package; registry: ReturnType<typeof createRegistry>; filter: string }
export async function loadEventPackage(path: string, position: Position): Promise<EventPackage> {
  const file = await open(path, 'r');
  let bytes: Buffer;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error('Substreams package must be a regular file below 16 MiB');
    bytes = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = await file.read(bytes, count, bytes.length - count, null);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    bytes = bytes.subarray(0, count);
  } finally { await file.close(); }
  if (createHash('sha256').update(bytes).digest('hex') !== SUBSTREAM_PACKAGE.sha256) throw new Error('Substreams package checksum mismatch');
  const pkg = createSubstream(bytes);
  const target = Position.parse(position);
  const filter = `evt_addr:${target.vault} || evt_addr:${MORPHO_BLUE_ETHEREUM}`;
  applyParams([`${SUBSTREAM_PACKAGE.module}=${filter}`], pkg.modules!.modules);
  return { pkg, registry: createRegistry(pkg), filter };
}

const Clock = z.object({ id: z.string(), number: z.string() });
const Events = z.object({ clock: Clock, events: z.array(z.object({ txHash: z.string(),
  log: z.object({ address: z.string(), blockIndex: z.number().int().nonnegative() }),
})).max(10000) });
const hash = (value: string) => value.startsWith('0x') ? value : `0x${value}`;

export function decodeStreamResponse(response: Response, registry: ReturnType<typeof createRegistry>): Frame | null {
  const { message } = response;
  if (message.case === 'fatalError') throw new Error('Substreams provider reported a fatal error');
  if (message.case === 'blockUndoSignal') {
    const { lastValidBlock, lastValidCursor } = message.value;
    if (!lastValidBlock) throw new Error('Substreams undo omitted its ancestor');
    return Frame.parse({ type: 'undo', cursor: lastValidCursor,
      block: { number: String(lastValidBlock.number), hash: hash(lastValidBlock.id) } });
  }
  if (message.case !== 'blockScopedData') return null;
  const { clock, cursor, output } = message.value;
  if (!clock) throw new Error('Substreams block omitted its clock');
  const block = { number: String(clock.number), hash: hash(clock.id) };
  if (output && output.name !== SUBSTREAM_PACKAGE.module) throw new Error('Unexpected Substreams output module');
  const unpacked = unpackMapOutput(response, registry);
  if (output?.mapOutput && !unpacked) throw new Error('Substreams output could not be decoded');
  const data = unpacked ? Events.parse(unpacked.toJson({ emitDefaultValues: true })) : null;
  if (data && (hash(data.clock.id) !== block.hash || data.clock.number !== block.number)) throw new Error('Substreams output clock mismatch');
  const events = (data?.events ?? []).map(event => {
    const address = Buffer.from(event.log.address, 'base64');
    if (address.length !== 20 || address.toString('base64') !== event.log.address) throw new Error('Invalid Substreams event address');
    return { address: `0x${address.toString('hex')}`, transactionHash: hash(event.txHash), logIndex: event.log.blockIndex };
  });
  return Frame.parse({ type: 'block', block, cursor, events });
}

export function eventStream(loaded: Awaited<ReturnType<typeof loadEventPackage>>, endpoint: string, token: string) {
  const url = new URL(validateHttpUrl(endpoint));
  const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) throw new Error('Substreams endpoint requires HTTPS outside loopback and no embedded credentials');
  if (!/^[\x21-\x7e]{1,4096}$/.test(token)) throw new Error('SUBSTREAMS_API_TOKEN is missing or invalid');
  const transport = createGrpcTransport({ httpVersion: '2', baseUrl: url.href, interceptors: [createAuthInterceptor(token)],
    readMaxBytes: 8 * 1024 * 1024 });
  return async function* (cursor: string, startBlock: string, stopBlock: string | undefined, signal: AbortSignal) {
    const request = createRequest({ substreamPackage: loaded.pkg, outputModule: SUBSTREAM_PACKAGE.module,
      productionMode: true, startBlockNum: BigInt(startBlock), startCursor: cursor,
      ...(stopBlock ? { stopBlockNum: BigInt(stopBlock) } : {}) });
    // A finite call timeout bounds stalled connections; the worker resumes from its durable cursor.
    const responses = streamBlocks(transport, request, { signal, timeoutMs: 300000 });
    try {
      for await (const response of responses) {
        const frame = decodeStreamResponse(response, loaded.registry);
        if (frame) yield frame;
      }
    } catch {
      if (!signal.aborted) throw new Error('Substreams stream failed; check provider configuration and retained cursor');
    }
  };
}
