import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

const WalletAddressContext = createContext<[string, Dispatch<SetStateAction<string>>] | null>(null);

export function WalletAddressProvider({ children }: { children: ReactNode }) {
  const wallet = useState('');
  return <WalletAddressContext.Provider value={wallet}>{children}</WalletAddressContext.Provider>;
}

export function useWalletAddress() {
  const wallet = useContext(WalletAddressContext);
  if (!wallet) throw new Error('Wallet address requires the application provider.');
  return wallet;
}
