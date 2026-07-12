'use client';

import { useState, FormEvent } from 'react';

interface RegisterProductFormProps {
  disabled: boolean;
  isSubmitting: boolean;
  onSubmit: (
    name: string,
    description: string,
    initialPrice: string,
  ) => Promise<void>;
}

/**
 * Form used to register a brand-new product on-chain, along with
 * its initial price (the first entry of its price history).
 */
export default function RegisterProductForm({
  disabled,
  isSubmitting,
  onSubmit,
}: RegisterProductFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) {
      setLocalError('Product name is required.');
      return;
    }
    if (!price || Number(price) <= 0) {
      setLocalError('Initial price must be a positive number.');
      return;
    }

    try {
      await onSubmit(name.trim(), description.trim(), price);
      setName('');
      setDescription('');
      setPrice('');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]"
    >
      <h2 className="text-lg font-semibold">Register a New Product</h2>

      <label className="flex flex-col gap-1 text-sm">
        Product Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Organic Coffee Beans 250g"
          className="rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className="rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Initial Price (integer units, e.g. cents)
        <input
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 1999"
          className="rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/[.145] dark:focus:border-white/40"
        />
      </label>

      {localError && <p className="text-sm text-red-500">{localError}</p>}

      <button
        type="submit"
        disabled={disabled || isSubmitting}
        className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isSubmitting ? 'Registering...' : 'Register Product'}
      </button>

      {disabled && (
        <p className="text-xs text-zinc-500">
          Connect your wallet to register a product.
        </p>
      )}
    </form>
  );
}
