import { Address, BigInt, dataSource } from '@graphprotocol/graph-ts';
import { Transfer, VaultShares } from '../generated/VaultShares/VaultShares';
import { AccountBalance, ShareTransfer, Vault } from '../generated/schema';

const ZERO = Address.zero();

function changeBalance(vault: Vault, account: Address, amount: BigInt, block: BigInt): void {
  const id = vault.id.toHexString() + '-' + account.toHexString();
  let balance = AccountBalance.load(id);
  if (balance == null) {
    balance = new AccountBalance(id);
    balance.vault = vault.id;
    balance.account = account;
    balance.shares = BigInt.zero();
  }
  balance.shares = balance.shares.plus(amount);
  assert(!balance.shares.lt(BigInt.zero()), 'Incomplete or inconsistent share transfer history');
  balance.lastUpdateBlock = block;
  balance.save();
}

export function handleTransfer(event: Transfer): void {
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32());
  if (ShareTransfer.load(eventId) != null) return;
  let vault = Vault.load(event.address);
  if (vault == null) {
    const contract = VaultShares.bind(event.address);
    const asset = contract.try_asset();
    const decimals = contract.try_decimals();
    assert(!asset.reverted && !decimals.reverted, 'Vault identity reads failed');
    vault = new Vault(event.address);
    vault.chainId = dataSource.context().getI32('chainId');
    vault.indexedFromBlock = dataSource.context().getBigInt('indexedFromBlock');
    vault.asset = asset.value;
    vault.shareDecimals = decimals.value;
    vault.totalShares = BigInt.zero();
  }
  const amount = event.params.value;
  assert(!amount.lt(BigInt.zero()), 'Negative transfer');
  if (event.params.from.equals(ZERO)) vault.totalShares = vault.totalShares.plus(amount);
  else changeBalance(vault, event.params.from, BigInt.zero().minus(amount), event.block.number);
  if (event.params.to.equals(ZERO)) vault.totalShares = vault.totalShares.minus(amount);
  else changeBalance(vault, event.params.to, amount, event.block.number);
  assert(!vault.totalShares.lt(BigInt.zero()), 'Negative share supply');
  vault.lastUpdateBlock = event.block.number;
  vault.save();

  const transfer = new ShareTransfer(eventId);
  transfer.vault = vault.id;
  transfer.sender = event.params.from;
  transfer.receiver = event.params.to;
  transfer.shares = amount;
  transfer.blockNumber = event.block.number;
  transfer.blockHash = event.block.hash;
  transfer.transactionHash = event.transaction.hash;
  transfer.logIndex = event.logIndex;
  transfer.save();
}
