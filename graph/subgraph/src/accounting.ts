import { Address, BigInt, Bytes, dataSource, ethereum } from '@graphprotocol/graph-ts';
import { AccountingRead, AccountingState } from '../generated/schema';

class Contract extends ethereum.SmartContract {
  constructor(address: Address) { super('Accounting', address); }
}
const MORPHO = Address.fromString('0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb');

function encode(values: Array<ethereum.Value>): Bytes {
  const encoded = ethereum.encode(ethereum.Value.fromTuple(changetype<ethereum.Tuple>(values)));
  assert(encoded !== null, 'Accounting ABI encoding failed');
  return changetype<Bytes>(encoded);
}

function read(ids: Array<string>, vault: Address, to: Address, selector: string,
  signature: string, args: Array<ethereum.Value> = []): Array<ethereum.Value> {
  const name = signature.split('(')[0];
  const response = new Contract(to).tryCall(name, signature, args);
  assert(!response.reverted, 'Accounting contract read reverted');
  const data = Bytes.fromHexString(selector).concat(encode(args));
  const id = vault.toHexString() + '-' + to.toHexString() + '-' + data.toHexString();
  const observation = new AccountingRead(id);
  observation.to = to;
  observation.data = data;
  observation.result = encode(response.value);
  observation.save();
  ids.push(id);
  return response.value;
}

export function handleAccountingBlock(block: ethereum.Block): void {
  const vault = dataSource.address();
  const ids = new Array<string>();
  const morpho = read(ids, vault, vault, '0x3acb5624', 'MORPHO():(address)')[0].toAddress();
  assert(morpho.equals(MORPHO), 'Unsupported Morpho deployment');
  read(ids, vault, vault, '0x38d52e0f', 'asset():(address)');
  read(ids, vault, vault, '0x18160ddd', 'totalSupply():(uint256)');
  read(ids, vault, vault, '0x01e1d114', 'totalAssets():(uint256)');
  read(ids, vault, vault, '0xddca3f43', 'fee():(uint256)');
  read(ids, vault, vault, '0x568efc07', 'lastTotalAssets():(uint256)');
  read(ids, vault, vault, '0xaea70acc', 'DECIMALS_OFFSET():(uint8)');
  const count = read(ids, vault, vault, '0x33f91ebb', 'withdrawQueueLength():(uint256)')[0].toBigInt();
  assert(count.le(BigInt.fromI32(64)), 'Unsupported allocation queue size');
  const seen = new Array<string>();
  for (let index = 0; index < count.toI32(); index++) {
    const market = read(ids, vault, vault, '0x62518ddf', 'withdrawQueue(uint256):(bytes32)',
      [ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(index))])[0];
    const key = market.toBytes().toHexString();
    assert(seen.indexOf(key) < 0, 'Duplicate allocation');
    seen.push(key);
    read(ids, vault, MORPHO, '0x2c3c9157', 'idToMarketParams(bytes32):(address,address,address,address,uint256)', [market]);
    read(ids, vault, MORPHO, '0x5c60e39a', 'market(bytes32):(uint128,uint128,uint128,uint128,uint128,uint128)', [market]);
    read(ids, vault, MORPHO, '0x93c52062', 'position(bytes32,address):(uint256,uint128,uint128)',
      [market, ethereum.Value.fromAddress(vault)]);
  }
  const state = new AccountingState(vault);
  state.chainId = dataSource.context().getI32('chainId');
  state.blockNumber = block.number;
  state.blockHash = block.hash;
  state.timestamp = block.timestamp;
  state.reads = ids;
  state.save();
}
