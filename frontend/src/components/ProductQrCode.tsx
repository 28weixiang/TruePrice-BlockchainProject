'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, ScanLine } from 'lucide-react';

interface ProductQrCodeProps {
  productId: bigint;
}

/**
 * Renders a real, scannable Verification QR Code that deep-links to
 * this product's `/verify/[id]` route. Scanning it (or clicking the
 * "Scan Product QR" simulation button) takes a consumer to a page
 * that aggregates the product's on-chain blockchain state (from the
 * PriceTracker contract on the local Hardhat node) together with
 * simulated off-chain metadata (as if pulled from a PostgreSQL-backed
 * store), exactly as outlined in the TruePrice proposal's
 * verification workflow.
 */
export default function ProductQrCode({ productId }: ProductQrCodeProps) {
  const [verifyUrl, setVerifyUrl] = useState<string>('');

  useEffect(() => {
    // window.location.origin is only available client-side, so this
    // is computed after mount to keep the URL correct on any host
    // (localhost during development, or a production domain).
    setVerifyUrl(`${window.location.origin}/verify/${productId.toString()}`);
  }, [productId]);

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <QrCode size={14} className="text-indigo-400" />
        Verification QR
      </div>

      <div className="rounded-lg border border-slate-800/40 bg-white p-2 shadow-inner">
        {verifyUrl ? (
          <QRCodeSVG value={verifyUrl} size={112} level="M" marginSize={0} />
        ) : (
          <div className="h-[112px] w-[112px] animate-pulse rounded bg-zinc-200" />
        )}
      </div>

      <a
        href={verifyUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500"
      >
        <ScanLine size={13} />
        Scan Product QR
      </a>
    </div>
  );
}
