import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { Token } from '../../../shared/types';

interface TokenInputProps {
  label: string;
  amount: string;
  onAmountChange: (value: string) => void;
  selectedToken: Token | null;
  onSelectToken: () => void;
  balance?: string;
  onMax?: () => void;
  disabled?: boolean;
}

const TokenInput: React.FC<TokenInputProps> = ({
  label,
  amount,
  onAmountChange,
  selectedToken,
  onSelectToken,
  balance,
  onMax,
  disabled = false,
}) => {
  return (
    <div className="bg-secondary p-4 flex flex-col gap-2 relative group">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">{label}</span>
        {selectedToken && (
          <span className="text-muted-foreground flex items-center gap-1">
            <span className="text-muted-foreground">Balance: {balance ?? '0.00'}</span>
            {!disabled && onMax && (
              <button
                type="button"
                onClick={onMax}
                className="text-primary hover:text-primary/80 ml-1 font-medium"
              >
                MAX
              </button>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 mt-2">
        <input
          type="text"
          value={amount}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, '');
            if (val.split('.').length > 2) return;
            onAmountChange(val);
          }}
          disabled={disabled}
          placeholder="0.0"
          className="bg-transparent text-3xl font-medium outline-none flex-1 min-w-0 placeholder:text-muted-foreground/50 text-foreground disabled:opacity-50"
        />

        <button
          onClick={onSelectToken}
          className={`flex items-center gap-2 px-3 py-1.5 shrink-0 transition-colors ${
            selectedToken 
              ? 'bg-background hover:bg-background/80 text-foreground' 
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {selectedToken ? (
            <>
              {selectedToken.logoURI ? (
                <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-6 h-6 rounded-full bg-muted" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {selectedToken.symbol.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-lg">{selectedToken.symbol}</span>
            </>
          ) : (
            <span className="font-semibold text-lg px-2">Select token</span>
          )}
          <ChevronDown className="w-5 h-5 ml-1" />
        </button>
      </div>
    </div>
  );
};

export default TokenInput;
