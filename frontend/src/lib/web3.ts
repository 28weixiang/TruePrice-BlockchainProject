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
 * The chain id of the local Hardhat network this app is built to
 * work with (see hardhat/hardhat.config.ts `localhost` network).
 * Used to detect and warn about network mismatches in the UI.
 */
export const EXPECTED_CHAIN_ID = 31337;

/**
 * The official government customs tariff rate, expressed in basis
 * points (1% = 100 bps), mirrored from the on-chain
 * `OFFICIAL_TARIFF_RATE_BPS` constant on the PriceTracker contract.
 * Used by the UI to flag potential cross-border fee overcharging
 * (Dimension 10) without needing an extra contract call.
 */
export const OFFICIAL_TARIFF_RATE_BPS = 1500;

/**
 * A single price history entry, formatted for use in the UI.
 */
export interface PriceHistoryEntry {
  price: bigint;
  timestamp: bigint;
}

/**
 * A single purchase record (Dimension 8: Scalper Bot Audit Trail),
 * formatted for use in the UI.
 */
export interface Purchase {
  buyer: string;
  timestamp: bigint;
}

/**
 * A single verified, purchase-gated review (Dimension 9), formatted
 * for use in the UI.
 */
export interface Review {
  reviewer: string;
  rating: number;
  text: string;
  timestamp: bigint;
}

/**
 * Full product information, formatted for use in the UI. Includes all
 * ten TruePrice supply-chain dimension fields, which (aside from
 * currentStock/stockSnapshotHash) are permanently fixed on-chain at
 * registration time and can never be altered afterwards — this
 * cryptographically binds these claims to the product record.
 */
export interface Product {
  id: bigint;
  name: string;
  description: string;
  seller: string;
  createdAt: bigint;
  warrantyMonths: bigint;
  specs: string;
  shippingFee: bigint;
  msrp: bigint;
  crossBorderFee: bigint;
  supplyChainBatchId: string;
  ipfsCertificateHash: string;
  currentStock: bigint;
  stockSnapshotHash: string;
}

/**
 * Grouped parameters accepted by the on-chain `registerProduct`
 * function. A struct is used on the contract side (instead of ~10
 * loose arguments) to avoid Solidity's "stack too deep" limitation,
 * so the frontend must submit a single object matching this shape.
 */
export interface RegisterProductParams {
  name: string;
  description: string;
  initialPrice: bigint;
  warrantyMonths: bigint;
  specs: string;
  shippingFee: bigint;
  msrp: bigint;
  crossBorderFee: bigint;
  supplyChainBatchId: string;
  ipfsCertificateHash: string;
  initialStock: bigint;
}

/**
 * Minimal typing for the injected `window.ethereum` provider exposed
 * by browser wallets such as MetaMask or Rabby. Wallets commonly set
 * boolean flags (e.g. `isMetaMask`, `isRabby`) to identify themselves,
 * and may expose a `providers` array when multiple wallet extensions
 * are installed side-by-side (a legacy de-facto convention popularized
 * by MetaMask, still used as a fallback below alongside the modern
 * EIP-6963 discovery mechanism).
 */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: Eip1193Provider[];
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/**
 * Identifiers for the wallets this app knows how to explicitly target
 * from the wallet-selection modal.
 */
export type WalletId = 'metamask' | 'rabby';

/**
 * Static metadata used to render each wallet option in the UI, and to
 * link users to the install page if it isn't detected.
 */
export const WALLET_OPTIONS: {
  id: WalletId;
  name: string;
  installUrl: string;
}[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    installUrl: 'https://metamask.io/download/',
  },
  {
    id: 'rabby',
    name: 'Rabby Wallet',
    installUrl: 'https://rabby.io/',
  },
];

// ------------------------- EIP-6963 Multi-Wallet Discovery -------------------------

/**
 * Shape of the `detail` payload dispatched with the `eip6963:announceProvider`
 * event, as defined by the EIP-6963 standard
 * (https://eips.ethereum.org/EIPS/eip-6963). Every installed wallet
 * extension that supports EIP-6963 announces itself this way, which is
 * the modern, reliable replacement for guessing based on
 * `window.ethereum.isMetaMask` / `isRabby` flags (those can conflict
 * when multiple wallets are installed and all try to claim
 * `window.ethereum`).
 */
interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

interface Eip6963AnnounceProviderEvent extends CustomEvent {
  detail: Eip6963ProviderDetail;
}

/**
 * In-memory registry of every wallet provider announced via EIP-6963
 * so far in this page session, keyed by the wallet's reverse-DNS id
 * (`rdns`), e.g. `io.metamask` or `io.rabby`.
 */
const eip6963Providers = new Map<string, Eip6963ProviderDetail>();

/**
 * Starts listening for EIP-6963 `announceProvider` events and
 * immediately broadcasts an `eip6963:requestProvider` event so that
 * every wallet extension already loaded on the page announces itself
 * right away (wallets also listen for this request event so they can
 * (re-)announce on demand). Safe to call multiple times; listeners are
 * only ever attached once per page load.
 */
let eip6963Initialized = false;
function initEip6963Discovery(): void {
  if (typeof window === 'undefined' || eip6963Initialized) return;
  eip6963Initialized = true;

  window.addEventListener('eip6963:announceProvider', (event) => {
    const { detail } = event as Eip6963AnnounceProviderEvent;
    if (detail?.info?.rdns) {
      eip6963Providers.set(detail.info.rdns, detail);
    }
  });

  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

/**
 * Maps our internal `WalletId` to the `rdns` (reverse-DNS) identifiers
 * that MetaMask and Rabby announce themselves with under EIP-6963.
 */
const WALLET_RDNS: Record<WalletId, string[]> = {
  metamask: ['io.metamask'],
  rabby: ['io.rabby'],
};

/**
 * Returns every distinct injected provider available in the page via
 * the legacy convention: flattening `window.ethereum.providers`
 * (present when multiple wallet extensions are installed) or falling
 * back to the single `window.ethereum` object. Used only as a
 * fallback for wallets that don't yet support EIP-6963.
 */
function getLegacyInjectedProviders(): Eip1193Provider[] {
  if (typeof window === 'undefined' || !window.ethereum) return [];

  if (window.ethereum.providers && window.ethereum.providers.length > 0) {
    return window.ethereum.providers;
  }

  return [window.ethereum];
}

/**
 * Returns true if any injected wallet provider is detected on the
 * page, via either EIP-6963 announcements or the legacy
 * `window.ethereum` object.
 */
export function hasInjectedWallet(): boolean {
  initEip6963Discovery();
  return eip6963Providers.size > 0 || getLegacyInjectedProviders().length > 0;
}

/**
 * Attempts to find the injected provider matching the given wallet id
 * (e.g. the specific MetaMask or Rabby provider, even if several
 * wallet extensions are installed at once). Prefers the modern,
 * reliable EIP-6963 discovery mechanism, and falls back to the legacy
 * `isMetaMask`/`isRabby` flag convention if no EIP-6963 announcement
 * was found. Returns `null` if that particular wallet isn't detected.
 */
export function findInjectedProvider(
  walletId: WalletId,
): Eip1193Provider | null {
  initEip6963Discovery();

  // 1. Prefer EIP-6963: look up by known rdns identifiers.
  const rdnsCandidates = WALLET_RDNS[walletId];
  for (const [rdns, detail] of eip6963Providers) {
    if (rdnsCandidates.some((candidate) => rdns.includes(candidate))) {
      return detail.provider;
    }
  }

  // 2. Fall back to the legacy `window.ethereum(.providers)` flags.
  const legacyProviders = getLegacyInjectedProviders();

  const match = legacyProviders.find((p) => {
    if (walletId === 'metamask') return Boolean(p.isMetaMask) && !p.isRabby;
    if (walletId === 'rabby') return Boolean(p.isRabby);
    return false;
  });

  if (match) return match;

  // 3. Last resort: if only one legacy provider is injected and it
  // doesn't self-identify at all (no EIP-6963, no isMetaMask/isRabby
  // flags), allow connecting to it via either option so the app still
  // works with generic/unknown wallets.
  if (
    eip6963Providers.size === 0 &&
    legacyProviders.length === 1 &&
    !legacyProviders[0].isMetaMask &&
    !legacyProviders[0].isRabby
  ) {
    return legacyProviders[0];
  }

  return null;
}

/**
 * Returns true if the given wallet is currently detected as injected
 * into the page (via EIP-6963 or legacy detection).
 */
export function isWalletInstalled(walletId: WalletId): boolean {
  return findInjectedProvider(walletId) !== null;
}

/**
 * Requests access to the user's wallet accounts for a specific,
 * explicitly-chosen wallet (MetaMask or Rabby) and returns an
 * ethers.js BrowserProvider + connected Signer.
 *
 * Throws an error if that wallet extension isn't installed/detected.
 */
export async function connectWallet(walletId: WalletId): Promise<{
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  address: string;
}> {
  const injected = findInjectedProvider(walletId);

  if (!injected) {
    const walletName =
      WALLET_OPTIONS.find((w) => w.id === walletId)?.name ?? walletId;
    throw new Error(
      `${walletName} was not detected in your browser. Please install it and refresh the page.`,
    );
  }

  const provider = new BrowserProvider(injected);

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

/**
 * Converts the raw tuple returned by the contract's `getProduct` view
 * function into a strongly-typed `Product` object.
 */
export function parseProductTuple(raw: {
  id: bigint;
  name: string;
  description: string;
  seller: string;
  createdAt: bigint;
  warrantyMonths: bigint;
  specs: string;
  shippingFee: bigint;
  msrp: bigint;
  crossBorderFee: bigint;
  supplyChainBatchId: string;
  ipfsCertificateHash: string;
  currentStock: bigint;
  stockSnapshotHash: string;
}): Product {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    seller: raw.seller,
    createdAt: raw.createdAt,
    warrantyMonths: raw.warrantyMonths,
    specs: raw.specs,
    shippingFee: raw.shippingFee,
    msrp: raw.msrp,
    crossBorderFee: raw.crossBorderFee,
    supplyChainBatchId: raw.supplyChainBatchId,
    ipfsCertificateHash: raw.ipfsCertificateHash,
    currentStock: raw.currentStock,
    stockSnapshotHash: raw.stockSnapshotHash,
  };
}
