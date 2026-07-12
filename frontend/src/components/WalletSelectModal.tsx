'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { WALLET_OPTIONS, WalletId, isWalletInstalled } from '@/lib/web3';

interface WalletSelectModalProps {
  isOpen: boolean;
  isConnecting: boolean;
  onClose: () => void;
  onSelect: (walletId: WalletId) => void;
}

/**
 * Modal dialog that lets the user explicitly choose which browser
 * wallet extension to connect with (MetaMask or Rabby Wallet).
 *
 * If the selected wallet isn't detected as installed in the browser,
 * clicking it opens that wallet's install page in a new tab instead
 * of attempting to connect.
 */
export default function WalletSelectModal({
  isOpen,
  isConnecting,
  onClose,
  onSelect,
}: WalletSelectModalProps) {
  // Allow closing the modal with the Escape key for convenience.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-select-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur-md"
      >
        <div className="flex items-center justify-between">
          <h2
            id="wallet-select-title"
            className="text-lg font-semibold text-slate-100"
          >
            Connect a Wallet
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Choose which wallet you&apos;d like to use to connect to TruePrice.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {WALLET_OPTIONS.map((wallet) => {
            const installed = isWalletInstalled(wallet.id);

            return (
              <button
                key={wallet.id}
                type="button"
                disabled={isConnecting}
                onClick={() => {
                  if (installed) {
                    onSelect(wallet.id);
                  } else {
                    window.open(
                      wallet.installUrl,
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-left transition-colors hover:border-indigo-500/40 hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-100">
                    {wallet.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {installed
                      ? 'Detected in your browser'
                      : 'Not installed — click to install'}
                  </span>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${
                    installed
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : 'bg-slate-700'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
