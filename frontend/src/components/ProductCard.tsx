'use client';

import { useState, FormEvent } from 'react';
import { ProductWithHistory } from '@/hooks/usePriceTracker';

interface ProductCardProps {
  product: ProductWithHistory;
  currentAccount: string | null;
  isSubmitting: boolean;
  onUpdatePrice: (productId: bigint, newPrice: string) => Promise<void>;
}

/** Formats a Unix timestamp (seconds) as a human-readable date/time string. */
function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

/**
 * Displays a single product's details and its complete on-chain
 * price history. If the connected wallet is the product's original
 * seller, also shows a form to push a new price update.
 */
export default function ProductCard({
  product,
  currentAccount,
  isSubmitting,
  onUpdatePrice,
}: ProductCardProps) {
  const [newPrice, setNewPrice] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isOwner =
    !!currentAccount &&
    currentAccount.toLowerCase() === product.seller.toLowerCase();

  const latest = product.history[product.history.length - 1];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!newPrice || Number(newPrice) <= 0) {
      setLocalError('New price must be a positive number.');
      return;
    }

    try {
      await onUpdatePrice(product.id, newPrice);
      setNewPrice('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{product.name}</h3>
          {product.description && (
            <p className="text-sm text-zinc-500">{product.description}</p>
          )}
        </div>
        <span className="whitespace-nowrap rounded-full bg-black/[.05] px-3 py-1 text-xs font-medium dark:bg-white/[.08]">
          #{product.id.toString()}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div>
          <span className="text-zinc-500">Current price: </span>
          <span className="font-semibold">{latest?.price.toString()}</span>
        </div>
        <div>
          <span className="text-zinc-500">Seller: </span>
          <span className="font-mono">
            {product.seller.slice(0, 6)}...{product.seller.slice(-4)}
          </span>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer select-none font-medium text-zinc-600 dark:text-zinc-400">
          Price History ({product.history.length})
        </summary>
        <ul className="mt-2 flex flex-col gap-1 border-l border-black/[.08] pl-3 dark:border-white/[.145]">
          {product.history
            .slice()
            .reverse()
            .map((entry, idx) => (
              <li key={idx} className="flex justify-between gap-4">
                <span>{entry.price.toString()}</span>
                <span className="text-zinc-500">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </li>
            ))}
        </ul>
      </details>

      {isOwner && (
        <form
          onSubmit={handleSubmit}
          className="mt-2 flex flex-wrap items-center gap-2 border-t border-black/[.08] pt-3 dark:border-white/[.145]"
        >
          <input
            type="number"
            min={1}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="New price"
            className="w-32 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {isSubmitting ? 'Updating...' : 'Update Price'}
          </button>
          {localError && (
            <span className="text-sm text-red-500">{localError}</span>
          )}
        </form>
      )}
    </div>
  );
}
