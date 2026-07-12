'use client';

interface WalletConnectProps {
  account: string | null;
  isConnecting: boolean;
  onConnect: () => void;
}

/**
 * Displays a "Connect Wallet" button, or the connected account
 * address (shortened) once a wallet is connected.
 */
export default function WalletConnect({
  account,
  isConnecting,
  onConnect,
}: WalletConnectProps) {
  if (account) {
    const short = `${account.slice(0, 6)}...${account.slice(-4)}`;
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Connected: {short}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onConnect}
      disabled={isConnecting}
      className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
