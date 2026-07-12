'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  PackageCheck,
  Store,
  MapPin,
  Star,
  Database,
  Blocks,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  BadgeCheck,
  Sparkles,
  Truck,
  Tags,
  Globe2,
  Boxes,
  Fingerprint,
  Leaf,
  History,
} from 'lucide-react';
import { BrowserProvider, JsonRpcProvider, JsonRpcSigner } from 'ethers';
import {
  getContract,
  parseProductTuple,
  OFFICIAL_TARIFF_RATE_BPS,
  PriceHistoryEntry,
  Product,
  Purchase,
  Review,
} from '@/lib/web3';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import { getMockOffchainMetadata } from '@/lib/mockOffchainMetadata';

interface VerifyPageProps {
  params: Promise<{ id: string }>;
}

type LoadState = 'loading' | 'not-found' | 'error' | 'ready';

/**
 * The public "Verify Product" page — this is the destination that
 * each product's Verification QR Code deep-links to. It demonstrates
 * the full TruePrice verification workflow: a consumer scans a
 * product's QR code, and this page aggregates:
 *   1. Real, on-chain blockchain state read directly from the
 *      PriceTracker smart contract on the local Hardhat node —
 *      including all ten TruePrice supply-chain dimension fields
 *      (logistics fee, batch linkage, inventory snapshot, MSRP,
 *      provenance certificate, specs, warranty, purchase audit
 *      trail, verified reviews, and cross-border tariff).
 *   2. Simulated off-chain metadata (as if pulled from a
 *      PostgreSQL-backed store) — e.g. store name/location — shown
 *      side-by-side to illustrate how a production deployment would
 *      merge off-chain enrichment data with the tamper-proof
 *      on-chain source of truth.
 *
 * This route requires no wallet connection — anyone can verify any
 * product, since all `get*` calls on PriceTracker are public view
 * functions.
 */
export default function VerifyPage({ params }: VerifyPageProps) {
  const { id } = use(params);

  const [state, setState] = useState<LoadState>('loading');
  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState('loading');
      setErrorMessage(null);

      try {
        // Prefer the wallet's injected provider if present (so this
        // works even if the user has a wallet open), but fall back to
        // a direct JSON-RPC connection to the local Hardhat node so
        // this verification page works for any visitor — including
        // those without a wallet installed, exactly like a real
        // public-facing verification page should.
        const runner: BrowserProvider | JsonRpcSigner | JsonRpcProvider =
          typeof window !== 'undefined' && window.ethereum
            ? new BrowserProvider(window.ethereum)
            : new JsonRpcProvider('http://127.0.0.1:8545');

        const contract = getContract(runner as BrowserProvider);

        const productId = BigInt(id);

        const productTuple = await contract.getProduct(productId);

        const [prices, timestamps]: [bigint[], bigint[]] =
          await contract.getPriceHistory(productId);

        const rawPurchases = await contract.getPurchases(productId);
        const rawReviews = await contract.getReviews(productId);

        if (cancelled) return;

        setProduct(parseProductTuple(productTuple));
        setHistory(
          prices.map((price, i) => ({ price, timestamp: timestamps[i] })),
        );
        setPurchases(
          rawPurchases.map((p: { buyer: string; timestamp: bigint }) => ({
            buyer: p.buyer,
            timestamp: p.timestamp,
          })),
        );
        setReviews(
          rawReviews.map(
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
          ),
        );
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('Product does not exist') ||
          message.includes('missing revert data')
        ) {
          setState('not-found');
        } else {
          setErrorMessage(message);
          setState('error');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12 sm:px-10">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-indigo-400"
        >
          <ArrowLeft size={14} />
          Back to TruePrice
        </Link>

        <header className="flex items-center gap-3 border-b border-slate-800/80 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Product Verification
            </h1>
            <p className="text-sm text-slate-500">
              Aggregating on-chain blockchain state &amp; off-chain metadata for
              product #{id}
            </p>
          </div>
        </header>

        {state === 'loading' && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-8 text-center text-sm text-slate-400 shadow-2xl shadow-indigo-500/5 backdrop-blur-md">
            <Sparkles size={16} className="animate-pulse text-indigo-400" />
            Verifying product on the blockchain...
          </div>
        )}

        {state === 'not-found' && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400 shadow-lg shadow-red-500/5">
            <AlertTriangle size={20} className="shrink-0" />
            <span>
              No product with id <strong>#{id}</strong> was found on-chain. This
              QR code may be invalid or the product may not exist on the
              connected network.
            </span>
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-400 shadow-lg shadow-amber-500/5">
            <AlertTriangle size={20} className="shrink-0" />
            <span>
              Could not reach the blockchain to verify this product.{' '}
              {errorMessage}
            </span>
          </div>
        )}

        {state === 'ready' && product && (
          <VerifiedProductDetails
            product={product}
            history={history}
            purchases={purchases}
            reviews={reviews}
          />
        )}
      </main>
    </div>
  );
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function VerifiedProductDetails({
  product,
  history,
  purchases,
  reviews,
}: {
  product: Product;
  history: PriceHistoryEntry[];
  purchases: Purchase[];
  reviews: Review[];
}) {
  const offchain = getMockOffchainMetadata(product.id);
  const latest = history[history.length - 1];

  const officialTariffAmount =
    (product.msrp * BigInt(OFFICIAL_TARIFF_RATE_BPS)) / BigInt(10000);
  const isTariffOvercharged =
    product.msrp > BigInt(0) && product.crossBorderFee > officialTariffAmount;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
        <CheckCircle2 size={16} />
        Verified authentic — record confirmed directly on-chain
      </div>

      {/* -------- On-chain blockchain state (source of truth) -------- */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 shadow-2xl shadow-indigo-500/5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
          <Blocks size={16} />
          On-Chain Blockchain State (Hardhat Local Network)
        </div>

        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {product.name}
            </h2>
            {product.description && (
              <p className="text-sm text-slate-500">{product.description}</p>
            )}
          </div>
          <span className="whitespace-nowrap rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-400">
            #{product.id.toString()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-slate-500">Current price: </span>
            <span className="font-semibold text-slate-100">
              {latest?.price.toString() ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Registered seller: </span>
            <span className="font-mono text-slate-300">
              {shortAddress(product.seller)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Registered on: </span>
            <span className="text-slate-300">
              {new Date(Number(product.createdAt) * 1000).toLocaleDateString()}
            </span>
          </div>
        </div>

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

        <p className="text-xs text-slate-500">
          Warranty and specs/condition were permanently recorded on-chain at
          registration time and are cryptographically immutable — they cannot be
          retroactively altered by anyone, including the seller.
        </p>

        <PriceHistoryChart history={history} />
      </section>

      {/* -------- Logistics, MSRP & Tariff (Dimensions 1, 4, 10) -------- */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 shadow-2xl shadow-indigo-500/5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
          <Truck size={16} />
          Logistics &amp; Pricing Transparency
        </div>

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

        <div className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-violet-400">
            <Boxes size={13} />
            Anchored Inventory Snapshot
          </span>
          <span className="text-slate-400">
            Stock: {product.currentStock.toString()}
          </span>
        </div>
      </section>

      {/* -------- Provenance (Dimensions 2 & 5) -------- */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 shadow-2xl shadow-indigo-500/5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
          <Leaf size={16} />
          Provenance &amp; Certification
        </div>
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
      </section>

      {/* -------- Reviews (Dimension 9) -------- */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 shadow-2xl shadow-indigo-500/5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Star size={16} />
          Verified Purchase-Gated Reviews ({reviews.length})
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No verified reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reviews
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
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* -------- Audit Trail (Dimension 8) -------- */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 shadow-2xl shadow-indigo-500/5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
          <History size={16} />
          Public Purchase Audit Trail ({purchases.length})
        </div>
        {purchases.length === 0 ? (
          <p className="text-sm text-slate-500">No purchases recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 border-l border-slate-800 pl-3 text-sm">
            {purchases
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
      </section>

      {/* -------- Simulated off-chain metadata (PostgreSQL-style) -------- */}
      <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/20 p-5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
          <Database size={16} />
          Simulated Off-Chain Metadata (PostgreSQL)
        </div>

        <div className="flex items-center gap-3 text-2xl">
          <span>{offchain.imageEmoji}</span>
          <div className="text-sm">
            <div className="flex items-center gap-1.5 font-medium text-slate-200">
              <Store size={13} />
              {offchain.storeName}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <MapPin size={13} />
              {offchain.storeLocation}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          This metadata is simulated (deterministically derived from the product
          id) to demonstrate how a production TruePrice deployment would enrich
          the tamper-proof on-chain record with supplementary off-chain data,
          without ever allowing the off-chain layer to alter the price,
          warranty, or specs history above.
        </p>
        <p className="text-[11px] text-slate-600">
          Last synced: {offchain.lastSyncedAt}
        </p>
      </section>
    </div>
  );
}
