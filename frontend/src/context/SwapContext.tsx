import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Token } from '../../../shared/types';
import { DEFAULT_SLIPPAGE_BPS, DEFAULT_DEADLINE_MINUTES } from '../../../shared/constants';

interface SwapContextType {
  tokenIn: Token | null;
  setTokenIn: (token: Token | null) => void;
  tokenOut: Token | null;
  setTokenOut: (token: Token | null) => void;
  amountIn: string;
  setAmountIn: (amount: string) => void;
  amountOut: string;
  setAmountOut: (amount: string) => void;
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
  deadlineMinutes: number;
  setDeadlineMinutes: (minutes: number) => void;
  reverseTokens: () => void;
}

const SwapContext = createContext<SwapContextType | undefined>(undefined);

export const SwapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState<string>('');
  const [amountOut, setAmountOut] = useState<string>('');
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [deadlineMinutes, setDeadlineMinutes] = useState<number>(DEFAULT_DEADLINE_MINUTES);

  const reverseTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(amountOut);
    setAmountOut('');
  };

  return (
    <SwapContext.Provider
      value={{
        tokenIn,
        setTokenIn,
        tokenOut,
        setTokenOut,
        amountIn,
        setAmountIn,
        amountOut,
        setAmountOut,
        slippageBps,
        setSlippageBps,
        deadlineMinutes,
        setDeadlineMinutes,
        reverseTokens,
      }}
    >
      {children}
    </SwapContext.Provider>
  );
};

export const useSwapState = () => {
  const context = useContext(SwapContext);
  if (context === undefined) {
    throw new Error('useSwapState must be used within a SwapProvider');
  }
  return context;
};
