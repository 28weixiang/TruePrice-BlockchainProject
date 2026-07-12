'use client';

import { useCallback, useEffect, useState } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import {
  connectWallet,
  EXPECTED_CHAIN_ID,
  getContract,
  hasInjectedWallet,
  parseProductTuple,
  Product,
  PriceHistoryEntry,
  Purchase,
  RegisterProductParams,
  Review,
  WalletId,
} from '@/lib/web3';

/**
 * A product together with its full, on-chain price history, purchase
 * audit trail (Dimension 8), and verified reviews (Dimension 9).
 */
export interface ProductWithHistory extends Product {
  history: PriceHistoryEntry[];
  purchases: Purchase[];
  reviews: Review[];
}

/**
 * React hook that encapsulates all wallet connection state and all
 * interactions with the PriceTracker smart contract.
 *
 * Responsibilities:
 * - Connect / disconnect the user's wallet (MetaMask or Rabby).
 * - Detect and warn about a wrong/unsupported network (chain id).
 * - Load the full list of registered products with their price
 *   history, purchase audit trail, and verified reviews.
 * - Register new products on-chain, permanently binding all ten
 *   TruePrice supply-chain dimension fields to them.
 * - Update the price of a product the current user owns (is the
 *   seller of).
 * - Anchor new inventory snapshots on-chain (Dimension 3).
 * - Record purchases (Dimension 8) and submit verified,
 *   purchase-gated reviews (Dimension 9).
 */
export function usePriceTracker() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<bigint | null>(null);

  const [products, setProducts] = useState<ProductWithHistory[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remembers which wallet the user last explicitly chose, so that
  // the "accountsChanged" listener below can silently reconnect to
  // the same wallet without needing to reopen the selection modal.
  const [lastWalletId, setLastWalletId] = useState<WalletId | null>(null);

  /**
   * True once we have a connected wallet whose network does not match
   * the expected local Hardhat network (chain id 31337). Used by the
   * UI to show a friendly "wrong network" warning banner instead of
   * letting contract calls silently fail with cryptic decode errors.
   */
  const isWrongNetwork =
    chainId !== null && chainId !== BigInt(EXPECTED_CHAIN_ID);

  /**
   * Disconnects the wallet by clearing local React state only. This
   * does not actually revoke the site's permission from within
   * MetaMask (that can only be done by the user via the wallet's own
   * UI), but it resets the app's connection state so the UI reverts
   * to the "Connect Wallet" view.
   */
  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setLastWalletId(null);
    setError(null);
  }, []);

  /**
   * Connects to a specific, explicitly-chosen browser wallet
   * (MetaMask or Rabby) and stores the resulting provider/signer/
   * address/chainId in state.
   */
  const connect = useCallback(async (walletId: WalletId) => {
    setError(null);
    setIsConnecting(true);
    try {
      const { provider: p, signer: s, address } = await connectWallet(walletId);
      const network = await p.getNetwork();
      setProvider(p);
      setSigner(s);
      setAccount(address);
      setChainId(network.chainId);
      setLastWalletId(walletId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Fetches every registered product along with its full price
   * history, purchase audit trail, and verified reviews from the
   * blockchain. Only runs once we have a valid provider/signer AND a
   * connected account AND the wallet is on the expected network —
   * otherwise the contract calls could point at the wrong chain and
   * fail with confusing decode errors, so we simply skip the read and
   * show an empty list instead.
   */
  const loadProducts = useCallback(async () => {
    const runner: BrowserProvider | JsonRpcSigner | null = signer ?? provider;

    if (!runner || !account || isWrongNetwork) {
      setProducts([]);
      return;
    }

    setIsLoadingProducts(true);
    setError(null);
    try {
      const contract = getContract(runner);

      const ids: bigint[] = await contract.getAllProductIds();

      const loaded: ProductWithHistory[] = await Promise.all(
        ids.map(async (id) => {
          const productTuple = await contract.getProduct(id);
          const [prices, timestamps]: [bigint[], bigint[]] =
            await contract.getPriceHistory(id);
          const rawPurchases = await contract.getPurchases(id);
          const rawReviews = await contract.getReviews(id);

          const history: PriceHistoryEntry[] = prices.map((price, i) => ({
            price,
            timestamp: timestamps[i],
          }));

          const purchases: Purchase[] = rawPurchases.map(
            (p: { buyer: string; timestamp: bigint }) => ({
              buyer: p.buyer,
              timestamp: p.timestamp,
            }),
          );

          const reviews: Review[] = rawReviews.map(
            (r: {
              reviewer: string;
              rating: number;
              text: string;
              timestamp: bigint;
            }) => ({
              reviewer: r.reviewer,
              rating: Number(r.rating),
              text: r.text,
              timestamp: r.timestamp,
            }),
          );

          return {
            ...parseProductTuple(productTuple),
            history,
            purchases,
            reviews,
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
  }, [provider, signer, account, isWrongNetwork]);

  /**
   * Registers a new product on-chain, permanently binding all ten
   * TruePrice supply-chain dimension fields to it. Requires a
   * connected wallet (signer) on the correct network, since this is a
   * state-changing transaction.
   */
  const registerProduct = useCallback(
    async (params: RegisterProductParams) => {
      if (!signer) {
        throw new Error('Please connect your wallet first.');
      }
      if (isWrongNetwork) {
        throw new Error(
          `Please switch your wallet to the Hardhat Local network (chain id ${EXPECTED_CHAIN_ID}) first.`,
        );
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const contract = getContract(signer);
        const tx = await contract.registerProduct(params);
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
    [signer, isWrongNetwork, loadProducts],
  );

  /**
   * Updates the price of an existing product. Requires a connected
   * wallet on the correct network, and the connected account must be
   * the original seller of the product (enforced on-chain by the
   * contract).
   */
  const updatePrice = useCallback(
    async (productId: bigint, newPrice: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet first.');
      }
      if (isWrongNetwork) {
        throw new Error(
          `Please switch your wallet to the Hardhat Local network (chain id ${EXPECTED_CHAIN_ID}) first.`,
        );
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
    [signer, isWrongNetwork, loadProducts],
  );

  /**
   * (Dimension 3) Anchors a new inventory snapshot hash on-chain.
   * Only callable by the product's original seller (enforced
   * on-chain). Used to cryptographically detect any later divergence
   * between a displayed "live" stock count and this anchored
   * snapshot — evidence of artificial scarcity tampering.
   */
  const recordStockSnapshot = useCallback(
    async (productId: bigint, newStock: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet first.');
      }
      if (isWrongNetwork) {
        throw new Error(
          `Please switch your wallet to the Hardhat Local network (chain id ${EXPECTED_CHAIN_ID}) first.`,
        );
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const contract = getContract(signer);
        const tx = await contract.recordStockSnapshot(
          productId,
          BigInt(newStock),
        );
        await tx.wait();
        await loadProducts();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to record stock snapshot';
        setError(message);
        throw new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [signer, isWrongNetwork, loadProducts],
  );

  /**
   * (Dimension 8) Records a purchase of a product by the connected
   * wallet, building an append-only, public audit trail that anyone
   * can later analyze for suspicious sub-second scalper-bot buying
   * patterns. This also grants the caller eligibility to submit a
   * verified review for the product.
   */
  const purchaseProduct = useCallback(
    async (productId: bigint) => {
      if (!signer) {
        throw new Error('Please connect your wallet first.');
      }
      if (isWrongNetwork) {
        throw new Error(
          `Please switch your wallet to the Hardhat Local network (chain id ${EXPECTED_CHAIN_ID}) first.`,
        );
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const contract = getContract(signer);
        const tx = await contract.purchaseProduct(productId);
        await tx.wait();
        await loadProducts();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to record purchase';
        setError(message);
        throw new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [signer, isWrongNetwork, loadProducts],
  );

  /**
   * (Dimension 9) Submits a verified review for a product. Reverts
   * on-chain unless the connected wallet has an existing purchase
   * record for this product, cryptographically preventing fake
   * reviews from accounts that never actually bought it.
   */
  const addReview = useCallback(
    async (productId: bigint, rating: number, text: string) => {
      if (!signer) {
        throw new Error('Please connect your wallet first.');
      }
      if (isWrongNetwork) {
        throw new Error(
          `Please switch your wallet to the Hardhat Local network (chain id ${EXPECTED_CHAIN_ID}) first.`,
        );
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const contract = getContract(signer);
        const tx = await contract.addReview(productId, rating, text);
        await tx.wait();
        await loadProducts();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to submit review';
        setError(message);
        throw new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [signer, isWrongNetwork, loadProducts],
  );

  // Load the product list once on mount, and whenever the connected
  // wallet/provider/network changes (so freshly-connected users still
  // see data, and stale data is cleared on disconnect/network switch).
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, signer, account, isWrongNetwork]);

  // React to the user switching accounts or networks in their wallet
  // extension, so the UI stays in sync.
  useEffect(() => {
    if (!hasInjectedWallet() || !window.ethereum?.on) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[] | undefined) ?? [];

      // The user disconnected all accounts from this site directly
      // within their wallet extension (e.g. via MetaMask's own
      // "Disconnect" UI). Gracefully clear our local state instead of
      // firing another connect prompt, which would be a jarring,
      // unexpected popup for the user.
      if (accounts.length === 0) {
        disconnect();
        return;
      }

      // Otherwise, re-trigger the connect flow to refresh the
      // signer/account, using whichever wallet the user last
      // explicitly selected.
      if (lastWalletId) {
        connect(lastWalletId);
      }
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
  }, [lastWalletId]);

  return {
    account,
    chainId,
    isWrongNetwork,
    isConnecting,
    isLoadingProducts,
    isSubmitting,
    error,
    products,
    connect,
    disconnect,
    loadProducts,
    registerProduct,
    updatePrice,
    recordStockSnapshot,
    purchaseProduct,
    addReview,
  };
}
