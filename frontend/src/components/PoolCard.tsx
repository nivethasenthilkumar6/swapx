import React, { useEffect, useState, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { useAccount, useConnect } from 'wagmi';
import { BrowserProvider, Contract, parseUnits, formatUnits } from 'ethers';
import TokenInput from './TokenInput';
import TokenModal from './TokenModal';
import FeeTierSelector from './FeeTierSelector';
import type { Token } from '../../../shared/types';
import { FEE_TIERS } from '../../../shared/constants';
import { LIQUIDITY_MANAGER_ADDRESS, LIQUIDITY_MANAGER_ABI, ERC20_ABI, normalizePath } from '../constants/contracts';
import { parseTransactionError } from '../utils/errors';

const PoolCard: React.FC = () => {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const [tokenA, setTokenA] = React.useState<Token | null>(null);
  const [tokenB, setTokenB] = React.useState<Token | null>(null);
  const [tokenABalance, setTokenABalance] = useState('0.00');
  const [tokenBBalance, setTokenBBalance] = useState('0.00');
  const [liquidityStatus, setLiquidityStatus] = useState<string | null>(null);

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

  const fetchTokenBalance = useCallback(async (token: Token | null, setter: React.Dispatch<React.SetStateAction<string>>) => {
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
  const [amountA, setAmountA] = React.useState('');
  const [amountB, setAmountB] = React.useState('');
  const [feeTier, setFeeTier] = React.useState<number>(FEE_TIERS[2].value); // Default 0.3%
  const [isAddingLiquidity, setIsAddingLiquidity] = React.useState(false);
  const [liquidityError, setLiquidityError] = React.useState<string | null>(null);

  const getMinimum = (amountUnits: bigint, slippageBps = 100): bigint => {
    return amountUnits - (amountUnits * BigInt(slippageBps) / 10000n);
  };

  const approveToken = async (tokenAddress: string, tokenSymbol: string, amountUnits: bigint, signer: any) => {
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
    setLiquidityStatus(`Checking ${tokenSymbol} allowance...`);
    const allowance = await tokenContract.allowance(address, LIQUIDITY_MANAGER_ADDRESS);
    if (allowance < amountUnits) {
      setLiquidityStatus(`Approving ${tokenSymbol} spend...`);
      const approveTx = await tokenContract.approve(LIQUIDITY_MANAGER_ADDRESS, amountUnits);
      setLiquidityStatus(`Waiting for ${tokenSymbol} approval...`);
      await approveTx.wait();
    }
  };
  
  const [isTokenAModalOpen, setIsTokenAModalOpen] = React.useState(false);
  const [isTokenBModalOpen, setIsTokenBModalOpen] = React.useState(false);

  useEffect(() => {
    void fetchTokenBalance(tokenA, setTokenABalance);
  }, [tokenA, fetchTokenBalance]);

  useEffect(() => {
    void fetchTokenBalance(tokenB, setTokenBBalance);
  }, [tokenB, fetchTokenBalance]);

  const canAddLiquidity = Boolean(
    tokenA &&
    tokenB &&
    amountA &&
    amountB &&
    parseFloat(amountA) > 0 &&
    parseFloat(amountB) > 0 &&
    (() => {
      const p = normalizePath([
        tokenA.isNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : tokenA.address,
        tokenB.isNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : tokenB.address
      ]);
      return p[0].toLowerCase() !== p[1].toLowerCase();
    })()
  );

  const onAddLiquidity = async () => {
    if (!canAddLiquidity || !tokenA || !tokenB || !address) return;
    setLiquidityError(null);
    setIsAddingLiquidity(true);
    setLiquidityStatus('Preparing transaction...');

    try {
      const signer = await getSigner();
      if (!signer) {
        throw new Error('Wallet signer not available');
      }

      const manager = new Contract(LIQUIDITY_MANAGER_ADDRESS, LIQUIDITY_MANAGER_ABI, signer);
      const amountAUnits = parseUnits(amountA, tokenA.isNative ? 18 : tokenA.decimals);
      const amountBUnits = parseUnits(amountB, tokenB.isNative ? 18 : tokenB.decimals);
      const amountAMin = getMinimum(amountAUnits);
      const amountBMin = getMinimum(amountBUnits);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      let tx: any;

      if (tokenA.isNative && tokenB.isNative) {
        throw new Error('Cannot add liquidity with two native tokens');
      }

      if (tokenA.isNative) {
        await approveToken(tokenB.address, tokenB.symbol, amountBUnits, signer);
        setLiquidityStatus('Submitting add liquidity transaction...');
        tx = await manager.addLiquidityETH(
          tokenB.address,
          amountBUnits,
          amountBMin,
          amountAMin,
          address,
          deadline,
          { value: amountAUnits }
        );
      } else if (tokenB.isNative) {
        await approveToken(tokenA.address, tokenA.symbol, amountAUnits, signer);
        setLiquidityStatus('Submitting add liquidity transaction...');
        tx = await manager.addLiquidityETH(
          tokenA.address,
          amountAUnits,
          amountAMin,
          amountBMin,
          address,
          deadline,
          { value: amountBUnits }
        );
      } else {
        await approveToken(tokenA.address, tokenA.symbol, amountAUnits, signer);
        await approveToken(tokenB.address, tokenB.symbol, amountBUnits, signer);
        setLiquidityStatus('Submitting add liquidity transaction...');
        tx = await manager.addLiquidity(
          tokenA.address,
          tokenB.address,
          amountAUnits,
          amountBUnits,
          amountAMin,
          amountBMin,
          address,
          deadline
        );
      }

      setLiquidityStatus('Waiting for confirmation...');
      await tx.wait();
      setAmountA('');
      setAmountB('');
      alert('Liquidity added successfully.');
      // Refresh balances
      void fetchTokenBalance(tokenA, setTokenABalance);
      void fetchTokenBalance(tokenB, setTokenBBalance);
    } catch (error) {
      console.error('Add liquidity failed:', error);
      setLiquidityError(parseTransactionError(error));
    } finally {
      setIsAddingLiquidity(false);
      setLiquidityStatus(null);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-card border border-border shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Add Liquidity</h2>
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <TokenInput
            label="Token 1"
            amount={amountA}
            onAmountChange={setAmountA}
            selectedToken={tokenA}
            onSelectToken={() => setIsTokenAModalOpen(true)}
            balance={tokenABalance}
            onMax={() => setAmountA(tokenABalance)}
          />
          <TokenInput
            label="Token 2"
            amount={amountB}
            onAmountChange={setAmountB}
            selectedToken={tokenB}
            onSelectToken={() => setIsTokenBModalOpen(true)}
            balance={tokenBBalance}
            onMax={() => setAmountB(tokenBBalance)}
          />
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Fee Tier</h3>
          <FeeTierSelector selectedFee={feeTier} onSelect={setFeeTier} />
        </div>

        {tokenA && tokenB && (
          <div className="p-4 border border-border bg-secondary mb-6">
            <h4 className="text-sm font-semibold mb-2">Initial Prices and Pool Share</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold">0.00</div>
                <div className="text-xs text-muted-foreground">{tokenA.symbol} per {tokenB.symbol}</div>
              </div>
              <div>
                <div className="text-lg font-bold">0.00</div>
                <div className="text-xs text-muted-foreground">{tokenB.symbol} per {tokenA.symbol}</div>
              </div>
              <div>
                <div className="text-lg font-bold">0%</div>
                <div className="text-xs text-muted-foreground">Share of Pool</div>
              </div>
            </div>
          </div>
        )}

        {liquidityError && (
          <div className="mb-4 text-xs text-destructive bg-destructive/10 p-3 border border-destructive/25 text-left leading-relaxed">
            {liquidityError}
          </div>
        )}

        <button
          id="pool-add-liquidity-btn"
          onClick={() => {
            if (!isConnected) {
              connect({ connector: connectors[0] });
              return;
            }
            if (canAddLiquidity) {
              onAddLiquidity();
            }
          }}
          disabled={isAddingLiquidity || (isConnected ? !canAddLiquidity : false)}
          className={`w-full py-4 font-bold text-lg transition-colors ${
            isConnected
              ? canAddLiquidity
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
          }`}
        >
          {!isConnected 
            ? 'Connect Wallet' 
            : isAddingLiquidity 
              ? (liquidityStatus || 'Adding Liquidity...') 
              : canAddLiquidity 
                ? 'Add Liquidity' 
                : 'Enter token amounts'}
        </button>
      </div>

      <TokenModal
        isOpen={isTokenAModalOpen}
        onClose={() => setIsTokenAModalOpen(false)}
        onSelect={setTokenA}
        selectedToken={tokenA}
        otherSelectedToken={tokenB}
      />

      <TokenModal
        isOpen={isTokenBModalOpen}
        onClose={() => setIsTokenBModalOpen(false)}
        onSelect={setTokenB}
        selectedToken={tokenB}
        otherSelectedToken={tokenA}
      />
    </div>
  );
};

export default PoolCard;
