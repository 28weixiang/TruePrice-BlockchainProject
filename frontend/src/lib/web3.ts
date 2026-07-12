'use client';

import { BrowserProvider, Contract, JsonRpcSigner } from 'ethers';
import contractInfo from '@/contracts/PriceTracker.json';

/**
 * Address of the deployed PriceTracker contract.
 * This value comes from `frontend/src/contracts/PriceTracker.json`,
 * which is generated/updated after running the Hardhat Ignition
 * deployment script (see hardhat/ignition/modules/PriceTracker.ts).
 */
export const CONTRACT_ADDRESS = contractInfo.address;

/**
 * ABI (Application Binary Interface) of the PriceTracker contract.
 * Used by ethers.js to know which functions/events exist on the
 * contract and how to encode/decode calls to it.
 */
export const CONTRACT_ABI = contractInfo.abi;

/**
 * A single price history entry, formatted for use in the UI.
 */
export interface PriceHistoryEntry {
  price: bigint;
  timestamp: bigint;
}

/**
 * Basic product information, formatted for use in the UI.
 */
export interface Product {
  id: bigint;
  name: string;
  description: string;
  seller: string;
  createdAt: bigint;
}

/**
 * Minimal typing for the injected `window.ethereum` provider exposed
 * by browser wallets such as MetaMask.
 */
interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/**
 * Returns true if a browser wallet extension (e.g. MetaMask) is
 * detected on `window.ethereum`.
 */
export function hasInjectedWallet(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'
  );
}

/**
 * Requests access to the user's wallet accounts and returns an
 * ethers.js BrowserProvider + connected Signer.
 *
 * Throws an error if no wallet extension is installed.
 */
export async function connectWallet(): Promise<{
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  address: string;
}> {
  if (!hasInjectedWallet()) {
    throw new Error(
      'No Ethereum wallet detected. Please install MetaMask to use this application.',
    );
  }

  const provider = new BrowserProvider(window.ethereum!);

  // Prompts the wallet's "connect" dialog if not already connected.
  await provider.send('eth_requestAccounts', []);

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

/**
 * Returns a read-only Contract instance connected to the given
 * provider (or signer). Read-only calls (view functions) can use
 * this without requiring a connected wallet.
 */
export function getContract(runner: BrowserProvider | JsonRpcSigner): Contract {
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, runner);
}
