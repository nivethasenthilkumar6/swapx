import React, { useState, useEffect } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import type { Token } from '../../../shared/types';

const BACKEND_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface BackendToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  chainId: number;
  priceUsd?: number;
  priceChange24h?: number;
}

function backendTokenToToken(t: BackendToken): Token {
  return {
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    logoURI: t.logoURI,
    isNative: t.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  };
}

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken?: Token | null;
  otherSelectedToken?: Token | null;
}

const TokenModal: React.FC<TokenModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedToken,
  otherSelectedToken,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tokens, setTokens] = useState<BackendToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch token list from backend (includes live CoinGecko prices)
  useEffect(() => {
    if (!isOpen) return;

    const fetchTokens = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BACKEND_URL}/api/tokens`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTokens(json.data);
        }
      } catch (err) {
        console.error('Failed to load tokens:', err);
        setError('Failed to load tokens. Is the backend running?');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, [isOpen]);

  const filteredTokens = tokens.filter((token) =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address.toLowerCase() === searchQuery.toLowerCase()
  );

  const popularTokens = tokens.slice(0, 6);

  const formatPrice = (price?: number): string => {
    if (!price) return '';
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const formatChange = (change?: number): string => {
    if (change === undefined || change === null) return '';
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border shadow-2xl p-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select a token</h2>
          <button id="token-modal-close" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="token-search-input"
            type="text"
            placeholder="Search name or paste address"
            className="w-full bg-secondary text-foreground pl-10 pr-4 py-3 outline-none border border-transparent focus:border-ring transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Popular tokens quick-select */}
        {!isLoading && popularTokens.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {popularTokens.map((token) => (
              <button
                key={token.symbol}
                id={`quick-select-${token.symbol}`}
                onClick={() => {
                  if (otherSelectedToken?.symbol !== token.symbol) {
                    onSelect(backendTokenToToken(token));
                    onClose();
                  }
                }}
                disabled={otherSelectedToken?.symbol === token.symbol}
                className={`flex items-center gap-2 px-3 py-1.5 border border-border rounded-full hover:bg-secondary transition-colors text-sm ${
                  otherSelectedToken?.symbol === token.symbol ? 'opacity-40 cursor-not-allowed' : ''
                } ${selectedToken?.symbol === token.symbol ? 'bg-secondary' : ''}`}
              >
                {token.logoURI ? (
                  <img
                    src={token.logoURI}
                    alt={token.symbol}
                    className="w-4 h-4 rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                    {token.symbol.charAt(0)}
                  </div>
                )}
                <span className="font-medium">{token.symbol}</span>
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-2 h-72 overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm">Loading live token data...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm text-center px-4 gap-2">
              <span className="text-destructive">⚠ {error}</span>
              <span className="text-xs">Make sure the backend is running on port 3001</span>
            </div>
          )}

          {!isLoading && !error && filteredTokens.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tokens found for "{searchQuery}"
            </div>
          )}

          {!isLoading && !error && filteredTokens.map((token) => (
            <button
              key={token.address || token.symbol}
              id={`token-list-${token.symbol}`}
              onClick={() => {
                if (otherSelectedToken?.symbol !== token.symbol) {
                  onSelect(backendTokenToToken(token));
                  onClose();
                }
              }}
              disabled={otherSelectedToken?.symbol === token.symbol}
              className={`w-full flex items-center justify-between p-3 hover:bg-secondary transition-colors ${
                otherSelectedToken?.symbol === token.symbol ? 'opacity-40 cursor-not-allowed' : ''
              } ${selectedToken?.symbol === token.symbol ? 'bg-secondary/60' : ''}`}
            >
              <div className="flex items-center gap-3">
                {token.logoURI ? (
                  <img
                    src={token.logoURI}
                    alt={token.symbol}
                    className="w-8 h-8 rounded-full bg-muted"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {token.symbol.charAt(0)}
                  </div>
                )}
                <div className="text-left">
                  <div className="font-medium text-sm">{token.symbol}</div>
                  <div className="text-xs text-muted-foreground">{token.name}</div>
                </div>
              </div>
              <div className="text-right">
                {token.priceUsd !== undefined && (
                  <>
                    <div className="font-medium text-sm">{formatPrice(token.priceUsd)}</div>
                    {token.priceChange24h !== undefined && (
                      <div
                        className={`text-xs ${
                          token.priceChange24h >= 0 ? 'text-green-500' : 'text-destructive'
                        }`}
                      >
                        {formatChange(token.priceChange24h)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-border text-center text-xs text-muted-foreground">
          Prices from <span className="text-primary">CoinGecko</span> · Sepolia Testnet
        </div>
      </div>
    </div>
  );
};

export default TokenModal;
