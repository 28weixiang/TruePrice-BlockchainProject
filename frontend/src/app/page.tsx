'use client';

import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePriceTracker } from '@/hooks/usePriceTracker';
import WalletConnect from '@/components/WalletConnect';
import RegisterProductForm from '@/components/RegisterProductForm';
import ProductCard from '@/components/ProductCard';

export default function Home() {
  const {
    account,
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
  } = usePriceTracker();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                TruePrice
              </h1>
              <p className="text-sm text-slate-500">
                On-chain product price history tracker
              </p>
            </div>
          </div>
          <WalletConnect
            account={account}
            isConnecting={isConnecting}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </header>

        {isWrongNetwork && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400 shadow-lg shadow-amber-500/5">
            <AlertTriangle size={18} className="shrink-0" />
            <span>
              You&apos;re connected to the wrong network. Please switch your
              wallet to the{' '}
              <span className="font-semibold text-amber-300">
                Hardhat Local
              </span>{' '}
              network (chain id{' '}
              <span className="font-mono text-amber-300">31337</span>) to use
              TruePrice.
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 shadow-lg shadow-red-500/5">
            {error}
          </div>
        )}

        <RegisterProductForm
          disabled={!account || isWrongNetwork}
          isSubmitting={isSubmitting}
          onSubmit={registerProduct}
        />

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              Registered Products{' '}
              <span className="text-slate-500">({products.length})</span>
            </h2>
            <button
              type="button"
              onClick={loadProducts}
              disabled={isLoadingProducts}
              className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-indigo-400 disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                className={isLoadingProducts ? 'animate-spin' : ''}
              />
              {isLoadingProducts ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {products.length === 0 && !isLoadingProducts && (
            <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
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
                onRecordStockSnapshot={recordStockSnapshot}
                onPurchase={purchaseProduct}
                onAddReview={addReview}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
