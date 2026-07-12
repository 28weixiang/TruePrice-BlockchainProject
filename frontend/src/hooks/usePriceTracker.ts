'use client';

import { useCallback, useEffect, useState } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import {
  connectWallet,
  getContract,
  hasInjectedWallet,
  Product,
  PriceHistoryEntry,
} from '@/lib/web3';

/**
 * A product together with its full, on-chain price history.
 */
export interface ProductWithHistory extends Product {
  history: PriceHistoryEntry[];
}

/**
 * React hook that encapsulates all wallet connection state and all
 * interactions with the PriceTracker smart contract.
 *
 * Responsibilities:
 * - Connect / disconnect the user's wallet (MetaMask).
 * - Load the full list of registered products with their price history.
 * - Register new products on-chain.
 * - Update the price of a product the current user owns (is the seller of).
 */
export function usePriceTracker() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductWithHistory[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Connects to the user's browser wallet (e.g. MetaMask) and stores
   * the resulting provider/signer/address in state.
   */
  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const { provider: p, signer: s, address } = await connectWallet();
      setProvider(p);
      setSigner(s);
      setAccount(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Fetches every registered product along with its full price
   * history from the blockchain. Uses a read-only provider connection
   * so it works even before the user connects their wallet
   * (falls back to the currently connected signer/provider if available).
   */
  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setError(null);
    try {
      let runner: BrowserProvider | JsonRpcSigner | null = signer ?? provider;

      // If the wallet hasn't been explicitly connected yet, but an
      // injected wallet (e.g. MetaMask) is present, use it in
      // read-only mode so product data can still be displayed.
      if (!runner && hasInjectedWallet()) {
        runner = new BrowserProvider(window.ethereum!);
      }

      if (!runner) {
        setProducts([]);
        return;
      }

      const contract = getContract(runner);

      const ids: bigint[] = await contract.getAllProductIds();

      const loaded: ProductWithHistory[] = await Promise.all(
        ids.map(async (id) => {
          const [productId, name, description, seller, createdAt] =
            await contract.getProduct(id);
          const [prices, timestamps]: [bigint[], bigint[]] =
            await contract.getPriceHistory(id);

          const history: PriceHistoryEntry[] = prices.map((price, i) => ({
            price,
            timestamp: timestamps[i],
          }));

          return {
            id: productId,
            name,
            description,
            seller,
            createdAt,
            history,
          };
        }),
      );

      // Show the most recently registered products first.
      loaded.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));

      setProducts(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoadingProducts(false);
    }
  }, [provider, signer]);

  /**
   * Registers a new product on-chain. Requires a connected wallet
   * (signer), since this is a state-changing transaction.
   */
  const registerProduct = useCallback(
    async (name: string, description: string, initialPrice: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet first.');
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const contract = getContract(signer);
        const tx = await contract.registerProduct(
          name,
          description,
          BigInt(initialPrice),
        );
        await tx.wait();
        await loadProducts();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to register product';
        setError(message);
        throw new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [signer, loadProducts],
  );

  /**
   * Updates the price of an existing product. Requires a connected
   * wallet, and the connected account must be the original seller of
   * the product (enforced on-chain by the contract).
   */
  const updatePrice = useCallback(
    async (productId: bigint, newPrice: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet first.');
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const contract = getContract(signer);
        const tx = await contract.updatePrice(productId, BigInt(newPrice));
        await tx.wait();
        await loadProducts();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update price';
        setError(message);
        throw new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [signer, loadProducts],
  );

  // Load the product list once on mount, and whenever the connected
  // wallet/provider changes (so freshly-connected users still see data).
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, signer]);

  // React to the user switching accounts or networks in their wallet
  // extension, so the UI stays in sync.
  useEffect(() => {
    if (!hasInjectedWallet() || !window.ethereum?.on) return;

    const handleAccountsChanged = () => {
      // Re-trigger the connect flow to refresh signer/account.
      connect();
    };
    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.(
        'accountsChanged',
        handleAccountsChanged,
      );
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    account,
    isConnecting,
    isLoadingProducts,
    isSubmitting,
    error,
    products,
    connect,
    loadProducts,
    registerProduct,
    updatePrice,
  };
}
