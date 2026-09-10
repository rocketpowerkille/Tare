import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer, type ServerHttp2Session } from 'node:http2';
import { Clock, Package, Response, Stream } from '@substreams/core/proto';
import { decodeStreamResponse, eventStream, SUBSTREAM_PACKAGE } from '../packages/sources/src/substreams.js';
import { monitorHash } from './helpers/monitor.js';

const require = createRequire(import.meta.url);
const { proto3, ScalarType, Any, createRegistry } = require('@bufbuild/protobuf') as
  typeof import('@bufbuild/protobuf', { with: { 'resolution-mode': 'require' } });
const { connectNodeAdapter } = require('@connectrpc/connect-node') as
  typeof import('@connectrpc/connect-node', { with: { 'resolution-mode': 'require' } });

// Minimal wire descriptors use the verified ethereum-common v0.3.3 field numbers.
const Log = proto3.makeMessageType('sf.ethereum.type.v2.Log', [
  { no: 1, name: 'address', kind: 'scalar', T: ScalarType.BYTES },
  { no: 6, name: 'blockIndex', kind: 'scalar', T: ScalarType.UINT32 },
]);
const Event = proto3.makeMessageType('sf.substreams.ethereum.v1.Event', [
  { no: 1, name: 'log', kind: 'message', T: Log },
  { no: 2, name: 'tx_hash', kind: 'scalar', T: ScalarType.STRING },
]);
const Events = proto3.makeMessageType('sf.substreams.ethereum.v1.Events', [
  { no: 1, name: 'clock', kind: 'message', T: Clock },
  { no: 2, name: 'events', kind: 'message', T: Event, repeated: true },
]);
const registry = createRegistry(Clock, Log, Event, Events);
const clock = { id: monitorHash('a').slice(2), number: '100' };
function response() {
  const events = Events.fromJson({ clock, events: [{ txHash: monitorHash('b').slice(2),
    log: { address: Buffer.from('11'.repeat(20), 'hex').toString('base64'), blockIndex: 7 } }] });
  return new Response({ message: { case: 'blockScopedData', value: { clock: { ...clock, number: 100n }, cursor: 'cursor-100',
    output: { name: SUBSTREAM_PACKAGE.module, mapOutput: new Any({
      typeUrl: `type.googleapis.com/${Events.typeName}`, value: events.toBinary(),
    }) } } } });
}
function loadedPackage() {
  // Local provider transport fixture, not an executable mainnet WASM package.
  const pkg = new Package({ modules: { modules: [{ name: SUBSTREAM_PACKAGE.module,
    kind: { case: 'kindMap', value: { outputType: `proto:${Events.typeName}` } } }],
    binaries: [{ type: 'wasm/rust-v1', content: new Uint8Array() }] } });
  return { pkg, registry, filter: '' };
}

test('Substreams decodes actual protobuf envelopes and uses block-wide log identity', () => {
  const frame = decodeStreamResponse(Response.fromBinary(response().toBinary()), registry);
  assert.equal(frame?.type, 'block');
  assert.equal(frame!.block.hash, monitorHash('a'));
  if (frame?.type !== 'block') assert.fail('missing block');
  assert.deepEqual(frame.events, [{ address: `0x${'11'.repeat(20)}`, transactionHash: monitorHash('b'), logIndex: 7 }]);
  const undo = new Response({ message: { case: 'blockUndoSignal', value: {
    lastValidBlock: { id: monitorHash('c').slice(2), number: 99n }, lastValidCursor: 'undo-99',
  } } });
  assert.deepEqual(decodeStreamResponse(undo, registry), { type: 'undo', block: { number: '99', hash: monitorHash('c') }, cursor: 'undo-99' });
});

test('Substreams rejects wrong module and mismatched clocks and does not treat progress as a trigger', () => {
  const wrong = response();
  if (wrong.message.case !== 'blockScopedData') assert.fail();
  wrong.message.value.output!.name = 'other';
  assert.throws(() => decodeStreamResponse(wrong, registry), /output module/);
  wrong.message.value.output!.name = SUBSTREAM_PACKAGE.module;
  wrong.message.value.clock!.id = monitorHash('c');
  assert.throws(() => decodeStreamResponse(wrong, registry), /clock mismatch/);
  assert.equal(decodeStreamResponse(new Response({ message: { case: 'progress', value: {} } }), registry), null);
  assert.throws(() => decodeStreamResponse(new Response({ message: { case: 'blockScopedData', value: {} } }), registry), /clock/);
  assert.throws(() => eventStream(loadedPackage(), 'http://example.com', 'token'), /HTTPS/);
  assert.throws(() => eventStream(loadedPackage(), 'https://example.com?key=secret', 'token'), /credentials/);
});

test('Substreams client sends a resumable gRPC request and consumes block/undo envelopes', async () => {
  let requests = 0;
  const handler = connectNodeAdapter({ routes(router) {
    router.service(Stream, { async *blocks(request, context) {
      requests++;
      assert.equal(request.startCursor, 'saved-cursor');
      assert.equal(request.startBlockNum, 100n);
      assert.equal(request.stopBlockNum, 102n);
      assert.equal(request.productionMode, true);
      assert.equal(request.outputModule, 'filtered_events');
      assert.equal(context.requestHeader.get('authorization'), 'Bearer local-test-token');
      yield response();
      yield new Response({ message: { case: 'blockUndoSignal', value: {
        lastValidBlock: { id: monitorHash('c').slice(2), number: 99n }, lastValidCursor: 'rewound',
      } } });
    } });
  } });
  const server = createServer(handler);
  const sessions = new Set<ServerHttp2Session>();
  server.on('session', session => { sessions.add(session); session.on('close', () => sessions.delete(session)); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const stream = eventStream(loadedPackage(), `http://127.0.0.1:${address.port}`, 'local-test-token');
    const frames = [];
    for await (const frame of stream('saved-cursor', '100', '102', new AbortController().signal)) frames.push(frame);
    assert.equal(requests, 1);
    assert.deepEqual(frames.map(frame => frame.type), ['block', 'undo']);
    assert.equal(frames[1]!.cursor, 'rewound');
  } finally {
    for (const session of sessions) session.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
