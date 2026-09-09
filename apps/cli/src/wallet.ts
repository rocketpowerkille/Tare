import { resolve } from 'node:path';
import { getNativeBalance } from '../../../packages/sources/src/rpc.js';
import { addWallet, getWallet, listWallets, removeWallet } from '../../../packages/wallet/src/index.js';
import { allowOptions, integer, nonnegativeInteger, required } from './args.js';
import type { CliValues } from './args.js';

export async function runWalletCommand(positionals: string[], values: CliValues): Promise<number> {
  const [, action, argument] = positionals;
  const home = resolve(values.home ?? process.env.TARE_HOME ?? '.tare');
  allowOptions(values, positionals,
    action === 'add' ? ['home', 'address', 'chain-id']
      : action === 'balance' ? ['home', 'rpc-url', 'symbol', 'decimals', 'timeout-ms', 'json']
        : ['home'],
    action === 'list' ? 2 : 3,
  );
  switch (action) {
    case 'add':
      console.log(JSON.stringify(await addWallet(home, {
        schemaVersion: 1,
        mode: 'watch-only',
        name: required(argument, 'wallet name'),
        address: required(values.address, '--address'),
        chainId: integer(values['chain-id'], '--chain-id'),
      }), null, 2));
      break;
    case 'list':
      console.log(JSON.stringify(await listWallets(home), null, 2));
      break;
    case 'show':
      console.log(JSON.stringify(await getWallet(home, required(argument, 'wallet name')), null, 2));
      break;
    case 'balance': {
      const wallet = await getWallet(home, required(argument, 'wallet name'));
      const result = await getNativeBalance(
        required(values['rpc-url'] ?? process.env.TARE_RPC_URL, '--rpc-url or TARE_RPC_URL'),
        wallet,
        { symbol: values.symbol ?? 'NATIVE', decimals: values.decimals === undefined ? 18 : nonnegativeInteger(values.decimals, '--decimals') },
        { timeoutMs: values['timeout-ms'] === undefined ? 10000 : integer(values['timeout-ms'], '--timeout-ms') },
      );
      console.log(values.json ? JSON.stringify(result, null, 2) : [
        `Native balance: ${result.balance} ${result.asset.symbol} (${result.balanceRaw} raw)`,
        `Address: ${result.address}`,
        `Chain: ${result.chainId}`,
        `Block: ${result.block.number} (${result.block.hash})`,
        'Verification: observed through the supplied EVM JSON-RPC endpoint',
      ].join('\n'));
      break;
    }
    case 'remove':
      await removeWallet(home, required(argument, 'wallet name'));
      console.log('Wallet profile removed');
      break;
    default:
      throw new Error('Unknown wallet command; use --help');
  }
  return 0;
}
