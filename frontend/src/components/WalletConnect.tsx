'use client';

import { useState } from 'react';
import { LogOut, Wallet } from 'lucide-react';
import { WalletId } from '@/lib/web3';
import WalletSelectModal from './WalletSelectModal';

interface WalletConnectProps {
  account: string | null;
  isConnecting: boolean;
  onConnect: (walletId: WalletId) => void;
  onDisconnect: () => void;
}

/**
 * Displays a "Connect Wallet" button that opens a wallet-selection
 * modal, or, once a wallet is connected, the shortened account
 * address alongside a "Disconnect" button.
 */
export default function WalletConnect({
  account,
  isConnecting,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  function handleSelect(walletId: WalletId) {
    setIsModalOpen(false);
    onConnect(walletId);
  }

  if (account) {
    const short = `${account.slice(0, 6)}...${account.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Connected: {short}
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          className="flex items-center gap-1.5 rounded-full border border-slate-800/80 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-300 backdrop-blur-md transition-colors hover:border-slate-700 hover:bg-slate-800/60"
        >
          <LogOut size={14} />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isConnecting}
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Wallet size={16} />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      <WalletSelectModal
        isOpen={isModalOpen}
        isConnecting={isConnecting}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
}
