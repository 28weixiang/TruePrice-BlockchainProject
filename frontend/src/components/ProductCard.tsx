'use client';

import { useState, FormEvent } from 'react';
import {
  ShieldCheck,
  PackageCheck,
  BadgeCheck,
  TrendingUp,
  Truck,
  Tags,
  Globe2,
  Boxes,
  Fingerprint,
  Leaf,
  ShoppingCart,
  Star,
  History,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { ProductWithHistory } from '@/hooks/usePriceTracker';
import { OFFICIAL_TARIFF_RATE_BPS } from '@/lib/web3';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import ProductQrCode from '@/components/ProductQrCode';

interface ProductCardProps {
  product: ProductWithHistory;
  currentAccount: string | null;
  isSubmitting: boolean;
  onUpdatePrice: (productId: bigint, newPrice: string) => Promise<void>;
  onRecordStockSnapshot: (productId: bigint, newStock: string) => Promise<void>;
  onPurchase: (productId: bigint) => Promise<void>;
  onAddReview: (
    productId: bigint,
    rating: number,
    text: string,
  ) => Promise<void>;
}

type TabId = 'overview' | 'logistics' | 'provenance' | 'reviews' | 'audit';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'logistics', label: 'Logistics & Pricing' },
  { id: 'provenance', label: 'Provenance' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'audit', label: 'Audit Trail' },
];

/** Formats a Unix timestamp (seconds) as a human-readable date/time string. */
function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Displays a single product's complete on-chain record across five
 * tabs, covering all ten TruePrice supply-chain dimensions:
 *
 * - Overview: price + price history chart + QR verification
 * - Logistics & Pricing: shipping fee, MSRP markup, cross-border
 *   tariff comparison, inventory snapshot
 * - Provenance: supply chain batch id + certificate hash + warranty/specs
 * - Reviews: verified, purchase-gated customer reviews
 * - Audit Trail: full public purchase history (anti-scalper-bot)
 */
export default function ProductCard({
  product,
  currentAccount,
  isSubmitting,
  onUpdatePrice,
  onRecordStockSnapshot,
  onPurchase,
  onAddReview,
}: ProductCardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('');
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewText, setReviewText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isOwner =
    !!currentAccount &&
    currentAccount.toLowerCase() === product.seller.toLowerCase();

  const hasPurchased =
    !!currentAccount &&
    product.purchases.some(
      (p) => p.buyer.toLowerCase() === currentAccount.toLowerCase(),
    );

  const latest = product.history[product.history.length - 1];

  const markupBps =
    product.msrp > BigInt(0)
      ? Number(((latest?.price ?? BigInt(0)) - product.msrp) * BigInt(10000)) /
        Number(product.msrp)
      : null;

  const officialTariffAmount =
    (product.msrp * BigInt(OFFICIAL_TARIFF_RATE_BPS)) / BigInt(10000);
  const isTariffOvercharged =
    product.msrp > BigInt(0) && product.crossBorderFee > officialTariffAmount;

  async function handlePriceSubmit(e: FormEvent) {
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

  async function handleStockSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!newStock || Number(newStock) < 0) {
      setLocalError('Stock must be zero or a positive number.');
      return;
    }

    try {
      await onRecordStockSnapshot(product.id, newStock);
      setNewStock('');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Stock update failed.',
      );
    }
  }

  async function handlePurchase() {
    setLocalError(null);
    try {
      await onPurchase(product.id);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Purchase failed.');
    }
  }

  async function handleReviewSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!reviewText.trim()) {
      setLocalError('Review text cannot be empty.');
      return;
    }

    try {
      await onAddReview(product.id, Number(reviewRating), reviewText.trim());
      setReviewText('');
      setReviewRating('5');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Submitting review failed.',
      );
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 shadow-2xl shadow-indigo-500/5 backdrop-blur-md transition-colors hover:border-slate-700/80">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-sm text-slate-500">{product.description}</p>
          )}
        </div>
        <span className="whitespace-nowrap rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-400">
          #{product.id.toString()}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className="text-indigo-400" />
          <span className="text-slate-500">Current price: </span>
          <span className="font-semibold text-slate-100">
            {latest?.price.toString()}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Seller: </span>
          <span className="font-mono text-slate-300">
            {shortAddress(product.seller)}
          </span>
        </div>
      </div>

      {/* Warranty & specs/condition — permanently bound on-chain at
          registration time, guaranteeing these claims can never be
          retroactively altered via an off-chain database. */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-400">
          <BadgeCheck size={13} />
          On-Chain Verified
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-medium text-amber-400">
          <ShieldCheck size={13} />
          {product.warrantyMonths > BigInt(0)
            ? `Warranty Secured · ${product.warrantyMonths.toString()}mo`
            : 'No Warranty'}
        </span>
        {product.specs && (
          <span className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 font-medium text-violet-400">
            <PackageCheck size={13} />
            Specs Logged · {product.specs}
          </span>
        )}
        {isTariffOvercharged && (
          <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 font-medium text-red-400">
            <AlertTriangle size={13} />
            Tariff Overcharge Flagged
          </span>
        )}
      </div>

      {/* -------- Tabs -------- */}
      <div className="flex flex-wrap gap-1 border-b border-slate-800/80 pb-1 text-xs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <PriceHistoryChart history={product.history} />
            <ProductQrCode productId={product.id} />
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer select-none font-medium text-slate-400 transition-colors hover:text-indigo-400">
              Raw Price History ({product.history.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 border-l border-slate-800 pl-3">
              {product.history
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <li key={idx} className="flex justify-between gap-4">
                    <span className="text-slate-200">
                      {entry.price.toString()}
                    </span>
                    <span className="text-slate-500">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </li>
                ))}
            </ul>
          </details>

          {isOwner && (
            <form
              onSubmit={handlePriceSubmit}
              className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3"
            >
              <input
                type="number"
                min={1}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="New price"
                className="w-32 rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition-colors focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {isSubmitting ? 'Updating...' : 'Update Price'}
              </button>
            </form>
          )}

          {!isOwner && !hasPurchased && (
            <button
              type="button"
              onClick={handlePurchase}
              disabled={isSubmitting || !currentAccount}
              className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart size={14} />
              {isSubmitting ? 'Processing...' : 'Purchase (record on-chain)'}
            </button>
          )}

          {hasPurchased && (
            <span className="mt-2 flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <CheckCircle2 size={13} />
              You have a verified purchase of this product
            </span>
          )}
        </div>
      )}

      {activeTab === 'logistics' && (
        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Truck size={12} className="text-sky-400/80" />
                Shipping Fee
              </span>
              <span className="font-semibold text-slate-100">
                {product.shippingFee.toString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Tags size={12} className="text-fuchsia-400/80" />
                MSRP
              </span>
              <span className="font-semibold text-slate-100">
                {product.msrp.toString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Globe2 size={12} className="text-cyan-400/80" />
                Cross-Border Fee
              </span>
              <span className="font-semibold text-slate-100">
                {product.crossBorderFee.toString()}
              </span>
            </div>
          </div>

          {markupBps !== null && (
            <p className="text-xs text-slate-500">
              Current price is{' '}
              <span
                className={
                  markupBps > 0
                    ? 'font-semibold text-amber-400'
                    : 'font-semibold text-emerald-400'
                }
              >
                {(markupBps / 100).toFixed(1)}%
              </span>{' '}
              {markupBps > 0 ? 'above' : 'at/below'} the registered MSRP.
            </p>
          )}

          <div
            className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
              isTariffOvercharged
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            {isTariffOvercharged ? (
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            )}
            <span>
              Official tariff reference (
              {(OFFICIAL_TARIFF_RATE_BPS / 100).toFixed(2)}% of MSRP) ≈{' '}
              {officialTariffAmount.toString()}. Merchant charges{' '}
              {product.crossBorderFee.toString()}.{' '}
              {isTariffOvercharged
                ? 'This exceeds the official government rate — potential tariff padding.'
                : 'This is within the official government rate.'}
            </span>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-400">
              <Boxes size={13} />
              Inventory Snapshot (Dimension 3)
            </span>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Current stock:{' '}
                <span className="font-semibold text-slate-200">
                  {product.currentStock.toString()}
                </span>
              </span>
              <span className="font-mono text-[10px] text-slate-600">
                hash: {product.stockSnapshotHash.slice(0, 10)}...
              </span>
            </div>

            {isOwner && (
              <form
                onSubmit={handleStockSubmit}
                className="flex flex-wrap items-center gap-2 pt-1"
              >
                <input
                  type="number"
                  min={0}
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  placeholder="New stock count"
                  className="w-36 rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition-colors focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Anchoring...' : 'Anchor New Snapshot'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === 'provenance' && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Fingerprint size={12} className="text-rose-400/80" />
              Supply Chain Batch Id
            </span>
            <span className="font-mono text-slate-200">
              {product.supplyChainBatchId || '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Leaf size={12} className="text-emerald-400/80" />
              Origin / Sustainability Certificate (IPFS hash)
            </span>
            <span className="break-all font-mono text-xs text-slate-200">
              {product.ipfsCertificateHash || '—'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            These fields were written on-chain permanently at registration and
            cryptographically bind this listing to a verified batch and
            certificate — they can never be retroactively altered.
          </p>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="flex flex-col gap-3">
          {product.reviews.length === 0 && (
            <p className="text-sm text-slate-500">
              No verified reviews yet for this product.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {product.reviews
              .slice()
              .reverse()
              .map((review, idx) => (
                <li
                  key={idx}
                  className="flex flex-col gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          className={
                            i < review.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-700'
                          }
                        />
                      ))}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {shortAddress(review.reviewer)}
                    </span>
                  </div>
                  <p className="text-slate-300">{review.text}</p>
                  <span className="text-[11px] text-slate-600">
                    {formatTimestamp(review.timestamp)}
                  </span>
                </li>
              ))}
          </ul>

          {hasPurchased ? (
            <form
              onSubmit={handleReviewSubmit}
              className="flex flex-col gap-2 border-t border-slate-800/80 pt-3"
            >
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Rating</label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(e.target.value)}
                  className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-2 py-1 text-sm text-slate-100 outline-none"
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r} className="bg-slate-900">
                      {r} star{r > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={2}
                className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-fit rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Verified Review'}
              </button>
            </form>
          ) : (
            <p className="border-t border-slate-800/80 pt-3 text-xs text-slate-500">
              Only wallets with a verified purchase record may submit a review,
              preventing fake reviews from non-buyers.
            </p>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <History size={13} className="text-indigo-400" />
            Full, append-only purchase audit trail ({product.purchases.length})
            — used to expose suspicious sub-second scalper-bot buying patterns.
          </p>
          {product.purchases.length === 0 ? (
            <p className="text-sm text-slate-500">No purchases recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 border-l border-slate-800 pl-3 text-sm">
              {product.purchases
                .slice()
                .reverse()
                .map((purchase, idx) => (
                  <li key={idx} className="flex justify-between gap-4">
                    <span className="font-mono text-slate-200">
                      {shortAddress(purchase.buyer)}
                    </span>
                    <span className="text-slate-500">
                      {formatTimestamp(purchase.timestamp)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {localError && <span className="text-sm text-red-400">{localError}</span>}
    </div>
  );
}
