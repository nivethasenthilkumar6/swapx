import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

const WalletButton: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [showDropdown, setShowDropdown] = useState(false);

  // Shorten address
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  if (isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-none hover:bg-secondary/80 transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
          {shortAddress}
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-card border border-border shadow-lg z-50">
            <div className="p-4 border-b border-border">
              <p className="text-sm font-medium">Connected Account</p>
              <p className="text-xs text-muted-foreground mt-1 break-all">{address}</p>
            </div>
            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-muted transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-none hover:bg-primary/90 transition-colors"
    >
      Connect Wallet
    </button>
  );
};

export default WalletButton;
