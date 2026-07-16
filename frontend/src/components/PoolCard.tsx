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
    const tokenContract = new Contract(tokenAddress, [
      ...ERC20_ABI,
      'function decimals() view returns (uint8)',
      'function name() view returns (string)',
    ], signer);

    setLiquidityStatus(`Checking ${tokenSymbol} allowance...`);

    // Verify it's a real ERC20 first
    try {
      await tokenContract.name();
    } catch {
      throw new Error(`${tokenSymbol} is not a valid ERC20 token on this network.`);
    }

    const currentAllowance: bigint = await tokenContract.allowance(address, LIQUIDITY_MANAGER_ADDRESS);

    if (currentAllowance < amountUnits) {
      setLiquidityStatus(`Approving ${tokenSymbol}... (confirm in wallet)`);
      // Use MaxUint256 so user doesn't need to approve again for future txs
      const MaxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const approveTx = await tokenContract.approve(LIQUIDITY_MANAGER_ADDRESS, MaxUint256);
      setLiquidityStatus(`Waiting for ${tokenSymbol} approval confirmation...`);
      const receipt = await approveTx.wait();
      if (!receipt || receipt.status === 0) {
        throw new Error(`Approval transaction for ${tokenSymbol} failed on-chain.`);
      }
      // Small pause to let RPC node sync the new allowance
      await new Promise(resolve => setTimeout(resolve, 1500));
    } else {
      setLiquidityStatus(`${tokenSymbol} already approved ✓`);
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

  const [poolData, setPoolData] = useState<{
    exists: boolean;
    reserveA: string;
    reserveB: string;
    priceA: string;
    priceB: string;
    userPoolShare: string;
    userLPBalance: string;
  } | null>(null);

  const fetchPoolData = useCallback(async () => {
    if (!tokenA || !tokenB) {
      setPoolData(null);
      return;
    }

    const provider = await getProvider();
    if (!provider) return;

    try {
      const manager = new Contract(LIQUIDITY_MANAGER_ADDRESS, LIQUIDITY_MANAGER_ABI, provider);
      
      const tokenAAddress = tokenA.isNative ? normalizePath(['0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'])[0] : tokenA.address;
      const tokenBAddress = tokenB.isNative ? normalizePath(['0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'])[0] : tokenB.address;

      if (tokenAAddress.toLowerCase() === tokenBAddress.toLowerCase()) {
        setPoolData(null);
        return;
      }

      const [pairAddress, exists] = await manager.checkPair(tokenAAddress, tokenBAddress);
      
      if (!exists) {
        setPoolData({ exists: false, reserveA: '0', reserveB: '0', priceA: '0', priceB: '0', userPoolShare: '100', userLPBalance: '0' });
        return;
      }

      const [reserveA, reserveB] = await manager.getReserves(tokenAAddress, tokenBAddress);
      
      const resA = Number(formatUnits(reserveA, tokenA.decimals));
      const resB = Number(formatUnits(reserveB, tokenB.decimals));
      
      const priceA = resA > 0 ? (resB / resA).toFixed(6) : '0';
      const priceB = resB > 0 ? (resA / resB).toFixed(6) : '0';

      let userPoolShare = '0';
      let userLPBalance = '0';
      if (address) {
        const [balance, totalSupply] = await manager.getLPBalance(tokenAAddress, tokenBAddress, address);
        userLPBalance = formatUnits(balance, 18);
        if (totalSupply > 0n) {
          userPoolShare = ((Number(balance) / Number(totalSupply)) * 100).toFixed(4);
        }
      }

      setPoolData({
        exists: true,
        reserveA: resA.toLocaleString(undefined, { maximumFractionDigits: 4 }),
        reserveB: resB.toLocaleString(undefined, { maximumFractionDigits: 4 }),
        priceA,
        priceB,
        userPoolShare,
        userLPBalance
      });

    } catch (error) {
      console.error('Failed to fetch pool data:', error);
      setPoolData(null);
    }
  }, [tokenA, tokenB, address, connector]);

  useEffect(() => {
    void fetchPoolData();
    // Refresh pool data every 10 seconds
    const interval = setInterval(() => void fetchPoolData(), 10000);
    return () => clearInterval(interval);
  }, [fetchPoolData]);

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
      // We set min to 0 to allow arbitrary input ratios. 
      // The router will find the optimal ratio and LiquidityManager will refund the rest.
      const amountAMin = 0n;
      const amountBMin = 0n;
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

  // Fetch top available pools when no tokens are selected
  const [availablePools, setAvailablePools] = useState<{
    tokenA: Token;
    tokenB: Token;
    reserveA: string;
    reserveB: string;
    pairAddress: string;
  }[] | null>(null);
  const [isLoadingPools, setIsLoadingPools] = useState(false);

  useEffect(() => {
    if (tokenA || tokenB) return;

    const loadAvailablePools = async () => {
      setIsLoadingPools(true);
      try {
        const provider = await getProvider();
        if (!provider) return;

        // Fetch tokens from backend
        const BACKEND_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(`${BACKEND_URL}/api/tokens`);
        if (!res.ok) throw new Error('Failed to fetch tokens');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) throw new Error('Invalid token data');

        // Take top 6 tokens
        const topTokens = json.data.slice(0, 6).map((t: any) => ({
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          logoURI: t.logoURI,
          isNative: t.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        } as Token));

        const manager = new Contract(LIQUIDITY_MANAGER_ADDRESS, LIQUIDITY_MANAGER_ABI, provider);
        const poolsFound = [];

        // Check combinations
        for (let i = 0; i < topTokens.length; i++) {
          for (let j = i + 1; j < topTokens.length; j++) {
            const tA = topTokens[i];
            const tB = topTokens[j];
            const addrA = tA.isNative ? normalizePath(['0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'])[0] : tA.address;
            const addrB = tB.isNative ? normalizePath(['0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'])[0] : tB.address;

            if (addrA.toLowerCase() === addrB.toLowerCase()) continue;

            const [pairAddress, exists] = await manager.checkPair(addrA, addrB);
            if (exists) {
              const [resA, resB] = await manager.getReserves(addrA, addrB);
              const numResA = Number(formatUnits(resA, tA.decimals));
              const numResB = Number(formatUnits(resB, tB.decimals));
              
              if (numResA > 0 && numResB > 0) {
                poolsFound.push({
                  tokenA: tA,
                  tokenB: tB,
                  reserveA: numResA.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                  reserveB: numResB.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                  pairAddress
                });
              }
            }
          }
        }
        setAvailablePools(poolsFound);
      } catch (error) {
        console.error('Error loading available pools:', error);
      } finally {
        setIsLoadingPools(false);
      }
    };
    
    void loadAvailablePools();
  }, [tokenA, tokenB, connector]);

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

        {/* Available Pools List (when nothing is selected) */}
        {!tokenA && !tokenB && (
          <div className="mb-6 border border-border rounded-lg bg-secondary/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary font-semibold text-sm">
              Available Liquidity Pools
            </div>
            <div className="p-2 max-h-60 overflow-y-auto">
              {isLoadingPools ? (
                <div className="text-center py-6 text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Finding active pools...
                </div>
              ) : availablePools && availablePools.length > 0 ? (
                <div className="space-y-2">
                  {availablePools.map((pool, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setTokenA(pool.tokenA);
                        setTokenB(pool.tokenB);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded bg-card hover:bg-secondary border border-border transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          <img src={pool.tokenA.logoURI || ''} alt={pool.tokenA.symbol} className="w-6 h-6 rounded-full bg-muted border-2 border-card" onError={(e) => (e.target as any).style.display = 'none'} />
                          <img src={pool.tokenB.logoURI || ''} alt={pool.tokenB.symbol} className="w-6 h-6 rounded-full bg-muted border-2 border-card" onError={(e) => (e.target as any).style.display = 'none'} />
                        </div>
                        <span className="font-semibold">{pool.tokenA.symbol} / {pool.tokenB.symbol}</span>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>{pool.reserveA} {pool.tokenA.symbol}</div>
                        <div>{pool.reserveB} {pool.tokenB.symbol}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No active pools found for popular tokens.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Fee Tier</h3>
          <FeeTierSelector selectedFee={feeTier} onSelect={setFeeTier} />
        </div>

        {tokenA && tokenB && poolData && (
          <div className="p-4 border border-border bg-secondary mb-6 rounded-lg space-y-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
              <span>Pool Information</span>
              {poolData.exists ? (
                <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full border border-green-500/20">Pool Exists</span>
              ) : (
                <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full border border-yellow-500/20">New Pool</span>
              )}
            </h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm bg-card p-3 rounded-md border border-border">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Available {tokenA.symbol}:</span>
                <span className="font-bold">{poolData.reserveA}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Available {tokenB.symbol}:</span>
                <span className="font-bold">{poolData.reserveB}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center py-2">
              <div>
                <div className="text-lg font-bold">{poolData.exists ? poolData.priceA : '-'}</div>
                <div className="text-xs text-muted-foreground">{tokenB.symbol} per {tokenA.symbol}</div>
              </div>
              <div>
                <div className="text-lg font-bold">{poolData.exists ? poolData.priceB : '-'}</div>
                <div className="text-xs text-muted-foreground">{tokenA.symbol} per {tokenB.symbol}</div>
              </div>
              <div>
                <div className="text-lg font-bold">{poolData.exists ? `${poolData.userPoolShare}%` : '100%'}</div>
                <div className="text-xs text-muted-foreground">Your Share of Pool</div>
              </div>
            </div>
            
            {poolData.exists && Number(poolData.userLPBalance) > 0 && (
              <div className="mt-2 text-center text-xs text-muted-foreground">
                You own <strong>{Number(poolData.userLPBalance).toFixed(6)}</strong> LP tokens
              </div>
            )}
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
