'use client';

import { useState, FormEvent } from 'react';
import {
  PackagePlus,
  Lock,
  Truck,
  Tags,
  Globe2,
  Boxes,
  Fingerprint,
  Leaf,
} from 'lucide-react';
import { RegisterProductParams } from '@/lib/web3';

interface RegisterProductFormProps {
  disabled: boolean;
  isSubmitting: boolean;
  onSubmit: (params: RegisterProductParams) => Promise<void>;
}

/** Preset options for the "Specs / Condition" dropdown. */
const CONDITION_OPTIONS = ['New', 'Refurbished', 'Used - Like New', 'Used'];

const inputClasses =
  'rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition-colors focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30';

const sectionLabelClasses =
  'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500';

/**
 * Form used to register a brand-new product on-chain. Beyond the
 * basics (name/description/initial price), this form collects all ten
 * TruePrice supply-chain dimension fields and submits them together
 * as a single grouped `RegisterProductParams` object, matching the
 * on-chain contract's struct-based `registerProduct` signature:
 *
 *   1. Shipping Fee          -> Dimension 1 (Logistics Cost Padding)
 *   2. Supply Chain Batch Id -> Dimension 2 (Counterfeit/Batch Linkage)
 *   3. Initial Stock         -> Dimension 3 (Inventory Snapshot anchor)
 *   4. MSRP                  -> Dimension 4 (Distributor Price Gouging)
 *   5. IPFS Certificate Hash -> Dimension 5 (Origin/Sustainability)
 *   6. Specs / Condition     -> Dimension 6 (Spec Bait-and-Switch)
 *   7. Warranty Period       -> Dimension 7 (Warranty Erasure)
 *  10. Cross-Border Fee      -> Dimension 10 (Tariff Padding)
 *
 * All of these (aside from stock) are written on-chain permanently at
 * registration and can never be altered afterwards.
 */
export default function RegisterProductForm({
  disabled,
  isSubmitting,
  onSubmit,
}: RegisterProductFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [specs, setSpecs] = useState(CONDITION_OPTIONS[0]);
  const [shippingFee, setShippingFee] = useState('');
  const [msrp, setMsrp] = useState('');
  const [crossBorderFee, setCrossBorderFee] = useState('');
  const [supplyChainBatchId, setSupplyChainBatchId] = useState('');
  const [ipfsCertificateHash, setIpfsCertificateHash] = useState('');
  const [initialStock, setInitialStock] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setDescription('');
    setPrice('');
    setWarrantyMonths('');
    setSpecs(CONDITION_OPTIONS[0]);
    setShippingFee('');
    setMsrp('');
    setCrossBorderFee('');
    setSupplyChainBatchId('');
    setIpfsCertificateHash('');
    setInitialStock('');
  }

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
    if (warrantyMonths && Number(warrantyMonths) < 0) {
      setLocalError('Warranty period cannot be negative.');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        initialPrice: BigInt(price),
        warrantyMonths: BigInt(warrantyMonths || '0'),
        specs: specs.trim(),
        shippingFee: BigInt(shippingFee || '0'),
        msrp: BigInt(msrp || '0'),
        crossBorderFee: BigInt(crossBorderFee || '0'),
        supplyChainBatchId: supplyChainBatchId.trim(),
        ipfsCertificateHash: ipfsCertificateHash.trim(),
        initialStock: BigInt(initialStock || '0'),
      });
      resetForm();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 shadow-2xl shadow-indigo-500/5 backdrop-blur-md"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
        <PackagePlus size={19} className="text-indigo-400" />
        Register a New Product
      </h2>

      {/* -------- Basics -------- */}
      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Product Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Organic Coffee Beans 250g"
          className={inputClasses}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className={inputClasses}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Initial Price (integer units, e.g. cents)
          <input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 1999"
            className={inputClasses}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Specs / Condition
          <select
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            className={inputClasses}
          >
            {CONDITION_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-slate-900">
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* -------- Dimension 7: Warranty -------- */}
      <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">
        <span className={sectionLabelClasses}>
          <Lock size={12} className="text-amber-500/70" />
          Warranty (Dimension 7)
        </span>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Warranty Period (months)
          <input
            type="number"
            min={0}
            value={warrantyMonths}
            onChange={(e) => setWarrantyMonths(e.target.value)}
            placeholder="e.g. 12"
            className={inputClasses}
          />
        </label>
      </div>

      {/* -------- Dimension 1: Logistics -------- */}
      <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">
        <span className={sectionLabelClasses}>
          <Truck size={12} className="text-sky-400/80" />
          Logistics Cost Transparency (Dimension 1)
        </span>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Shipping Fee (separate from price)
          <input
            type="number"
            min={0}
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
            placeholder="e.g. 50"
            className={inputClasses}
          />
        </label>
      </div>

      {/* -------- Dimension 4: MSRP -------- */}
      <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">
        <span className={sectionLabelClasses}>
          <Tags size={12} className="text-fuchsia-400/80" />
          MSRP Registry (Dimension 4)
        </span>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Manufacturer Suggested Retail Price
          <input
            type="number"
            min={0}
            value={msrp}
            onChange={(e) => setMsrp(e.target.value)}
            placeholder="e.g. 1200"
            className={inputClasses}
          />
        </label>
      </div>

      {/* -------- Dimension 10: Cross-Border Tariff -------- */}
      <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">
        <span className={sectionLabelClasses}>
          <Globe2 size={12} className="text-cyan-400/80" />
          Cross-Border Fee (Dimension 10)
        </span>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Cross-Border / Import Fee
          <input
            type="number"
            min={0}
            value={crossBorderFee}
            onChange={(e) => setCrossBorderFee(e.target.value)}
            placeholder="e.g. 100"
            className={inputClasses}
          />
          <span className="mt-1 text-xs text-slate-500">
            Compared automatically against the official government tariff rate
            to flag potential overcharging.
          </span>
        </label>
      </div>

      {/* -------- Dimension 2: Batch Linkage -------- */}
      <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">
        <span className={sectionLabelClasses}>
          <Fingerprint size={12} className="text-rose-400/80" />
          Supply Chain Batch Linkage (Dimension 2)
        </span>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Supply Chain Batch Id
          <input
            value={supplyChainBatchId}
            onChange={(e) => setSupplyChainBatchId(e.target.value)}
            placeholder="e.g. BATCH-2026-001"
            className={inputClasses}
          />
        </label>
      </div>

      {/* -------- Dimension 5: Provenance -------- */}
      <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">
        <span className={sectionLabelClasses}>
          <Leaf size={12} className="text-emerald-400/80" />
          Origin &amp; Sustainability Certificate (Dimension 5)
        </span>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          IPFS Certificate Hash (simulated)
          <input
            value={ipfsCertificateHash}
            onChange={(e) => setIpfsCertificateHash(e.target.value)}
            placeholder="e.g. QmExampleOrganicCertHash123"
            className={inputClasses}
          />
        </label>
      </div>

      {/* -------- Dimension 3: Inventory Snapshot -------- */}
      <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">
        <span className={sectionLabelClasses}>
          <Boxes size={12} className="text-violet-400/80" />
          Inventory Snapshot (Dimension 3)
        </span>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Initial Stock Quantity
          <input
            type="number"
            min={0}
            value={initialStock}
            onChange={(e) => setInitialStock(e.target.value)}
            placeholder="e.g. 500"
            className={inputClasses}
          />
        </label>
      </div>

      <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
        <Lock size={12} className="mt-0.5 shrink-0 text-amber-500/70" />
        Warranty, specs, shipping fee, MSRP, cross-border fee, batch id, and
        certificate hash are all written on-chain permanently at registration
        and can never be changed afterwards.
      </p>

      {localError && <p className="text-sm text-red-400">{localError}</p>}

      <button
        type="submit"
        disabled={disabled || isSubmitting}
        className="mt-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {isSubmitting ? 'Registering...' : 'Register Product'}
      </button>

      {disabled && (
        <p className="text-xs text-slate-500">
          Connect your wallet to register a product.
        </p>
      )}
    </form>
  );
}
