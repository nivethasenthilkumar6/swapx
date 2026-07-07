import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { AlertCircle } from 'lucide-react';

const NetworkWarning: React.FC = () => {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const SEPOLIA_CHAIN_ID = 11155111;

  if (!isConnected || chainId === SEPOLIA_CHAIN_ID) {
    return null;
  }

  return (
    <div className="bg-destructive text-destructive-foreground py-3 px-4 text-center text-sm font-semibold flex items-center justify-center gap-3 z-50 border-b border-destructive/20 animate-pulse">
      <AlertCircle className="w-5 h-5 animate-bounce" />
      <span>You are connected to an unsupported network. SwapX runs exclusively on Sepolia Testnet.</span>
      <button
        onClick={() => switchChain?.({ chainId: SEPOLIA_CHAIN_ID })}
        className="ml-2 bg-background text-foreground hover:bg-background/90 px-3 py-1.5 font-bold text-xs uppercase tracking-wider transition-all rounded shadow-md active:scale-95 cursor-pointer"
      >
        Switch to Sepolia
      </button>
    </div>
  );
};

export default NetworkWarning;
