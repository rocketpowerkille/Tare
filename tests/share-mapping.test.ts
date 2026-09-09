import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual mapping with a small Graph host double on Windows and Linux.
// This tests handler logic, not Graph Node's WASM host, indexing or reorg engine.
class GraphInt {
  constructor(readonly value: bigint) {}
  static zero() { return new GraphInt(0n); }
  plus(other: GraphInt) { return new GraphInt(this.value + other.value); }
  minus(other: GraphInt) { return new GraphInt(this.value - other.value); }
  lt(other: GraphInt) { return this.value < other.value; }
  toI32() { return Number(this.value); }
}
class Hex {
  constructor(readonly value: string) {}
  static zero() { return new Hex(`0x${'0'.repeat(40)}`); }
  equals(other: Hex) { return this.value === other.value; }
  toHexString() { return this.value; }
  concatI32(value: number) { return new Hex(`${this.value}-${value}`); }
}
const vaultAddress = new Hex(`0x${'ab'.repeat(20)}`);
const alice = new Hex(`0x${'11'.repeat(20)}`); const bob = new Hex(`0x${'22'.repeat(20)}`);
const event = (from: Hex, to: Hex, value: bigint, sequence: number) => ({
  address: vaultAddress, params: { from, to, value: new GraphInt(value) },
  block: { number: new GraphInt(BigInt(sequence)), hash: new Hex(`0x${'cd'.repeat(32)}`) },
  transaction: { hash: new Hex(`0x${sequence.toString(16).padStart(64, '0')}`) }, logIndex: GraphInt.zero(),
});
async function mapping(revert = false) {
  const store = new Map<string, Record<string, unknown>>();
  const key = (id: string | Hex) => typeof id === 'string' ? id : id.toHexString();
  function entity(name: string) {
    return class Entity {
      [field: string]: unknown;
      constructor(readonly id: string | Hex) {}
      save() { store.set(`${name}:${key(this.id)}`, { ...this }); }
      static load(id: string | Hex) {
        const existing = store.get(`${name}:${key(id)}`);
        return existing ? Object.assign(new Entity(id), existing) : null;
      }
    };
  }
  const exports: { handleTransfer?: (input: ReturnType<typeof event>) => void } = {};
  const source = await readFile('graph/subgraph/src/mapping.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(compiled, {
    exports, assert,
    require: (name: string) => {
      if (name === '@graphprotocol/graph-ts') return { Address: Hex, BigInt: GraphInt, dataSource: { context: () => ({ getI32: () => 1, getBigInt: () => GraphInt.zero() }) } };
      if (name.endsWith('/VaultShares')) return { VaultShares: { bind: () => ({ try_asset: () => ({ reverted: revert, value: bob }), try_decimals: () => ({ reverted: revert, value: 18 }) }) } };
      if (name.endsWith('/schema')) return { Vault: entity('Vault'), AccountBalance: entity('AccountBalance'), ShareTransfer: entity('ShareTransfer') };
      throw new Error(`Unexpected mapping import ${name}`);
    },
  }, { timeout: 1000 });
  const transfer = exports.handleTransfer; assert.ok(transfer);
  const shares = (account: Hex) => (store.get(`AccountBalance:${vaultAddress.value}-${account.value}`)?.shares as GraphInt | undefined)?.value;
  const supply = () => (store.get(`Vault:${vaultAddress.value}`)?.totalShares as GraphInt | undefined)?.value;
  return { transfer, shares, supply, store };
}
test('share mapping reconstructs mint, transfer, burn and fee mints without losing precision', async () => {
  const host = await mapping(); const quantity = 2n ** 100n;
  host.transfer(event(Hex.zero(), alice, quantity, 1));
  host.transfer(event(alice, bob, 37n, 2));
  host.transfer(event(bob, Hex.zero(), 7n, 3));
  host.transfer(event(Hex.zero(), bob, 11n, 4));
  assert.equal(host.shares(alice), quantity - 37n); assert.equal(host.shares(bob), 41n);
  assert.equal(host.supply(), quantity + 4n);
  assert.equal(host.shares(alice)! + host.shares(bob)!, host.supply());
  assert.equal([...host.store.keys()].filter(key => key.startsWith('ShareTransfer:')).length, 4);
});
test('share mapping handles self-transfers, zero transfers and duplicate event delivery', async () => {
  const host = await mapping(); const mint = event(Hex.zero(), alice, 100n, 1);
  host.transfer(mint); host.transfer(mint);
  host.transfer(event(alice, alice, 30n, 2));
  host.transfer(event(alice, bob, 0n, 3));
  assert.equal(host.supply(), 100n); assert.equal(host.shares(alice), 100n); assert.equal(host.shares(bob), 0n);
});
test('share mapping rejects incomplete transfer history and failed contract metadata reads', async () => {
  const host = await mapping();
  assert.throws(() => host.transfer(event(alice, bob, 1n, 1)), /history/);
  const broken = await mapping(true);
  assert.throws(() => broken.transfer(event(Hex.zero(), alice, 1n, 1)), /identity reads failed/);
  assert.equal(broken.store.size, 0);
});
