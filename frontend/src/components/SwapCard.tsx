import React, { useEffect, useState, useCallback } from 'react';
import { Settings, ArrowDown, Loader2 } from 'lucide-react';
import { useAccount, useConnect } from 'wagmi';
import { BrowserProvider, parseUnits, formatUnits, Contract } from 'ethers';
import TokenInput from './TokenInput';
import TokenModal from './TokenModal';
import { useSwapState } from '../context/SwapContext';
import { SLIPPAGE_PRESETS } from '../../../shared/constants';
import {
  SWAP_ROUTER_ADDRESS,
  SWAP_ROUTER_ABI,
  ERC20_ABI,
  NATIVE_ADDRESS,
  normalizePath,
} from '../constants/contracts';
import { parseTransactionError } from '../utils/errors';

const BACKEND_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const SwapCard: React.FC = () => {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const [tokenInBalance, setTokenInBalance] = useState('0.00');
  const [tokenOutBalance, setTokenOutBalance] = useState('0.00');
  const [swapStatus, setSwapStatus] = useState<string | null>(null);

  const getProvider = async () => {
    if (!connector) return null;
    try {
      const walletProvider = await connector.getProvider();
      return new BrowserProvider(walletProvider as any);
    } catch (e) {
      console.error('Failed to get provider from connector:', e);
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        return new BrowserProvider((window as any).ethereum);
      }
      return null;
    }
  };

  const getSigner = async () => {
    const provider = await getProvider();
    if (!provider) return null;
    return provider.getSigner();
  };

  const fetchTokenBalance = useCallback(async (token: { address: string; decimals: number; isNative?: boolean } | null, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (!address || !token) {
      setter('0.00');
      return;
    }

    const provider = await getProvider();
    if (!provider) {
      setter('0.00');
      return;
    }

    try {
      if (token.isNative) {
        const balance = await provider.getBalance(address);
        setter(formatUnits(balance, 18));
      } else {
        const tokenContract = new Contract(token.address, ERC20_ABI, provider);
        const rawBalance = await tokenContract.balanceOf(address);
        setter(formatUnits(rawBalance, token.decimals));
      }
    } catch (error) {
      console.error('Failed to fetch token balance:', error);
      setter('0.00');
    }
  }, [address, connector]);

  const {
    tokenIn, setTokenIn,
    tokenOut, setTokenOut,
    amountIn, setAmountIn,
    amountOut, setAmountOut,
    reverseTokens,
    slippageBps,
    setSlippageBps,
  } = useSwapState();

  const [isTokenInModalOpen, setIsTokenInModalOpen] = React.useState(false);
  const [isTokenOutModalOpen, setIsTokenOutModalOpen] = React.useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // ── Fetch quote when amountIn / tokens change ───────────────────────────
  const fetchQuote = useCallback(async () => {
    if (!tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      setAmountOut('');
      return;
    }
    if (!tokenIn.address || !tokenOut.address) {
      setAmountOut('');
      return;
    }

    setIsFetchingQuote(true);
    setQuoteError(null);

    try {
      let amountOutValue = '';
      const path = normalizePath([
        tokenIn.isNative ? NATIVE_ADDRESS : tokenIn.address,
        tokenOut.isNative ? NATIVE_ADDRESS : tokenOut.address,
      ]);

      try {
        const amountInUnits = parseUnits(amountIn, tokenIn.isNative ? 18 : tokenIn.decimals).toString();
        const params = new URLSearchParams();
        params.append('amountIn', amountInUnits);
        params.append('path', path[0]);
        params.append('path', path[1]);

        const quoteRes = await fetch(`${BACKEND_URL}/api/prices/quote?${params.toString()}`);
        if (quoteRes.ok) {
          const quoteJson = await quoteRes.json();
          const amountsOut: string[] = quoteJson.data?.amountsOut;
          if (Array.isArray(amountsOut) && amountsOut.length > 1) {
            amountOutValue = formatUnits(amountsOut[amountsOut.length - 1], tokenOut.isNative ? 18 : tokenOut.decimals);
          }
        }
      } catch (quoteError) {
        console.warn('On-chain quote failed, falling back to market estimate', quoteError);
      }

      if (!amountOutValue) {
        const marketRes = await fetch(`${BACKEND_URL}/api/prices/market?symbols=${encodeURIComponent(tokenIn.symbol)},${encodeURIComponent(tokenOut.symbol)}`);
        if (!marketRes.ok) throw new Error(`Market price failed ${marketRes.status}`);
        const marketJson = await marketRes.json();
        const prices = marketJson.data?.prices || {};
        const priceIn = prices[tokenIn.symbol]?.usd;
        const priceOut = prices[tokenOut.symbol]?.usd;
        if (priceIn && priceOut && priceIn > 0 && priceOut > 0) {
          const amountInNum = parseFloat(amountIn);
          const usdValue = amountInNum * priceIn;
          const rawOut = usdValue / priceOut;
          amountOutValue = rawOut.toFixed(6);
        }
      }

      if (!amountOutValue || parseFloat(amountOutValue) === 0) {
        setAmountOut('');
        setQuoteError('Unable to calculate an estimated output for this pair.');
      } else {
        setAmountOut(amountOutValue);
      }
    } catch (err) {
      console.error('Quote fetch error:', err);
      setQuoteError('Unable to fetch quote');
      setAmountOut('');
    } finally {
      setIsFetchingQuote(false);
    }
  }, [tokenIn, tokenOut, amountIn, setAmountOut]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500); // debounce 500ms
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  useEffect(() => {
    void fetchTokenBalance(tokenIn, setTokenInBalance);
  }, [tokenIn, fetchTokenBalance]);

  useEffect(() => {
    void fetchTokenBalance(tokenOut, setTokenOutBalance);
  }, [tokenOut, fetchTokenBalance]);

  // ── Determine swap button state ─────────────────────────────────────────
  const executeSwap = async () => {
    const signer = await getSigner();
    if (!signer || !tokenIn || !tokenOut || !amountIn || parseFloat(amountIn) <= 0) {
      setSwapError('Unable to swap: missing wallet, tokens, or amount');
      return;
    }

    setSwapError(null);
    setIsSwapping(true);
    setSwapStatus('Preparing transaction...');

    try {
      const router = new Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
      const fromAddress = tokenIn.isNative ? NATIVE_ADDRESS : tokenIn.address;
      const toAddress = tokenOut.isNative ? NATIVE_ADDRESS : tokenOut.address;
      const path = normalizePath([fromAddress, toAddress]);

      if (path[0].toLowerCase() === path[1].toLowerCase()) {
        throw new Error("Direct swapping between ETH and WETH is not supported by the liquidity pools. Please select a different token pair (e.g. ETH to USDC).");
      }

      const amountInUnits = parseUnits(amountIn, tokenIn.isNative ? 18 : tokenIn.decimals);
      const amountOutMinUnits = amountOut
        ? parseUnits((parseFloat(amountOut) * (1 - slippageBps / 10000)).toFixed(tokenOut.isNative ? 18 : tokenOut.decimals), tokenOut.isNative ? 18 : tokenOut.decimals)
        : 0n;
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      if (tokenIn.isNative) {
        setSwapStatus('Submitting swap transaction...');
        const tx = await router.swapExactETHForTokens(
          amountOutMinUnits,
          path,
          address,
          deadline,
          { value: amountInUnits }
        );
        setSwapStatus('Waiting for confirmation...');
        await tx.wait();
      } else if (tokenOut.isNative) {
        const tokenContract = new Contract(tokenIn.address, ERC20_ABI, signer);
        setSwapStatus(`Checking ${tokenIn.symbol} allowance...`);
        const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
        if (allowance < amountInUnits) {
          setSwapStatus(`Approving ${tokenIn.symbol} spend...`);
          const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amountInUnits);
          setSwapStatus('Waiting for approval confirmation...');
          await approveTx.wait();
        }
        setSwapStatus('Submitting swap transaction...');
        const tx = await router.swapExactTokensForETH(
          amountInUnits,
          amountOutMinUnits,
          path,
          address,
          deadline
        );
        setSwapStatus('Waiting for confirmation...');
        await tx.wait();
      } else {
        const tokenContract = new Contract(tokenIn.address, ERC20_ABI, signer);
        setSwapStatus(`Checking ${tokenIn.symbol} allowance...`);
        const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
        if (allowance < amountInUnits) {
          setSwapStatus(`Approving ${tokenIn.symbol} spend...`);
          const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amountInUnits);
          setSwapStatus('Waiting for approval confirmation...');
          await approveTx.wait();
        }
        setSwapStatus('Submitting swap transaction...');
        const tx = await router.swapExactTokensForTokens(
          amountInUnits,
          amountOutMinUnits,
          path,
          address,
          deadline
        );
        setSwapStatus('Waiting for confirmation...');
        await tx.wait();
      }

      setAmountIn('');
      setAmountOut('');
      setQuoteError(null);
      setSwapError(null);
      alert('Swap completed successfully.');
      // Refresh balances
      void fetchTokenBalance(tokenIn, setTokenInBalance);
      void fetchTokenBalance(tokenOut, setTokenOutBalance);
    } catch (err) {
      console.error('Swap failed:', err);
      setSwapError(parseTransactionError(err));
    } finally {
      setIsSwapping(false);
      setSwapStatus(null);
    }
  };

  const getSwapButton = () => {
    if (!isConnected) {
      return (
        <button
          id="swap-connect-wallet-btn"
          onClick={() => connect({ connector: connectors[0] })}
          className="w-full mt-4 py-4 bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          Connect Wallet
        </button>
      );
    }

    if (!tokenIn || !tokenOut) {
      return (
        <button
          id="swap-select-token-btn"
          disabled
          className="w-full mt-4 py-4 bg-secondary text-muted-foreground font-bold text-lg cursor-not-allowed"
        >
          Select a token
        </button>
      );
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      return (
        <button
          id="swap-enter-amount-btn"
          disabled
          className="w-full mt-4 py-4 bg-secondary text-muted-foreground font-bold text-lg cursor-not-allowed"
        >
          Enter an amount
        </button>
      );
    }

    if (isFetchingQuote) {
      return (
        <button
          id="swap-loading-btn"
          disabled
          className="w-full mt-4 py-4 bg-primary/70 text-primary-foreground font-bold text-lg cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          Fetching Quote...
        </button>
      );
    }

    if (swapError) {
      return (
        <div className="mt-4 flex flex-col gap-2">
          <div className="text-xs text-destructive bg-destructive/10 p-3 border border-destructive/25 text-left leading-relaxed">
            {swapError}
          </div>
          <button
            id="swap-execute-retry-btn"
            onClick={executeSwap}
            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all"
          >
            Try Swap Again
          </button>
        </div>
      );
    }

    if (quoteError) {
      return (
        <button
          id="swap-error-btn"
          disabled
          className="w-full mt-4 py-4 bg-destructive/20 text-destructive font-bold text-lg cursor-not-allowed"
        >
          {quoteError}
        </button>
      );
    }

    return (
      <button
        id="swap-execute-btn"
        disabled={isSwapping}
        onClick={executeSwap}
        className={`w-full mt-4 py-4 font-bold text-lg transition-all relative overflow-hidden group ${
          isSwapping
            ? 'bg-primary/70 text-primary-foreground cursor-not-allowed'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {isSwapping ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {swapStatus || 'Swapping...'}
          </span>
        ) : (
          <>
            <span className="relative z-10">Swap</span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </>
        )}
      </button>
    );
  };

  return (
    <div className="w-full max-w-md bg-card border border-border shadow-2xl overflow-hidden relative">
      {/* Decorative gradient blur in background */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground">Swap</h2>
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" id="swap-settings-btn">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <TokenInput
            label="Pay"
            amount={amountIn}
            onAmountChange={setAmountIn}
            selectedToken={tokenIn}
            onSelectToken={() => setIsTokenInModalOpen(true)}
            balance={tokenInBalance}
            onMax={() => setAmountIn(tokenInBalance)}
          />

          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10">
            <button
              id="swap-reverse-btn"
              onClick={reverseTokens}
              className="bg-background border-4 border-card p-1 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center hover:rotate-180 duration-300"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-1">
            <TokenInput
              label="Receive"
              amount={isFetchingQuote ? '...' : amountOut}
              onAmountChange={setAmountOut}
              selectedToken={tokenOut}
              onSelectToken={() => setIsTokenOutModalOpen(true)}
              balance={tokenOutBalance}
              disabled
            />
          </div>

          <div className="mt-4 rounded-xl border border-border bg-secondary p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
              <span>Slippage tolerance</span>
              <span>{(slippageBps / 100).toFixed(2)}%</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SLIPPAGE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSlippageBps(preset.value)}
                  className={`rounded-full px-3 py-2 text-sm border transition ${
                    slippageBps === preset.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary hover:text-primary'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Swap Info Row */}
        {tokenIn && tokenOut && amountOut && !isFetchingQuote && (
          <>
            <div className="mt-3 px-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Rate</span>
              <span>
                1 {tokenIn.symbol} ≈ {amountOut && amountIn
                  ? (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)
                  : '—'} {tokenOut.symbol}
              </span>
            </div>
            <div className="mt-2 px-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Minimum received</span>
              <span>
                {amountOut
                  ? (parseFloat(amountOut) * (1 - slippageBps / 10000)).toFixed(6)
                  : '—'} {tokenOut.symbol}
              </span>
            </div>
          </>
        )}

        {getSwapButton()}

        {isConnected && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        )}
      </div>

      <TokenModal
        isOpen={isTokenInModalOpen}
        onClose={() => setIsTokenInModalOpen(false)}
        onSelect={setTokenIn}
        selectedToken={tokenIn}
        otherSelectedToken={tokenOut}
      />

      <TokenModal
        isOpen={isTokenOutModalOpen}
        onClose={() => setIsTokenOutModalOpen(false)}
        onSelect={setTokenOut}
        selectedToken={tokenOut}
        otherSelectedToken={tokenIn}
      />
    </div>
  );
};

export default SwapCard;
