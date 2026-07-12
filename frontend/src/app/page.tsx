'use client';

import { usePriceTracker } from '@/hooks/usePriceTracker';
import WalletConnect from '@/components/WalletConnect';
import RegisterProductForm from '@/components/RegisterProductForm';
import ProductCard from '@/components/ProductCard';

export default function Home() {
  const {
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
  } = usePriceTracker();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TruePrice</h1>
            <p className="text-sm text-zinc-500">
              On-chain product price history tracker
            </p>
          </div>
          <WalletConnect
            account={account}
            isConnecting={isConnecting}
            onConnect={connect}
          />
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <RegisterProductForm
          disabled={!account}
          isSubmitting={isSubmitting}
          onSubmit={registerProduct}
        />

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Registered Products ({products.length})
            </h2>
            <button
              type="button"
              onClick={loadProducts}
              disabled={isLoadingProducts}
              className="text-sm text-zinc-500 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {isLoadingProducts ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {products.length === 0 && !isLoadingProducts && (
            <p className="text-sm text-zinc-500">
              No products registered yet. Connect your wallet and register the
              first one above.
            </p>
          )}

          <div className="flex flex-col gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id.toString()}
                product={product}
                currentAccount={account}
                isSubmitting={isSubmitting}
                onUpdatePrice={updatePrice}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
