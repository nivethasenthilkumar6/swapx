import React, { useEffect, useState } from 'react';
import AnalyticsCards from '../components/AnalyticsCards';
import { Loader2, AlertCircle } from 'lucide-react';

const BACKEND_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface PoolInfo {
  pairAddress: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  tvl: string;
}

interface OverviewData {
  totalPools: number;
  pools: PoolInfo[];
  totalTvl: string;
  timestamp: number;
}

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/overview`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to fetch overview');
      }
    } catch (err) {
      console.error('Failed to fetch analytics overview:', err);
      setError('Failed to load on-chain protocol analytics. Please verify the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const formatTVL = (tvlString: string): string => {
    const val = parseFloat(tvlString) || 0;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="flex flex-col items-center p-8 max-w-7xl mx-auto w-full">
      <div className="w-full flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Protocol Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Live market data integrated with CoinGecko</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {data ? `Updated: ${new Date(data.timestamp).toLocaleTimeString()}` : 'Updating...'}
        </div>
      </div>
      
      <AnalyticsCards totalTvl={data?.totalTvl || '0.00'} poolsCount={data?.totalPools || 0} />
      
      <div className="w-full bg-card border border-border p-6 mt-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Liquidity Pools Overview</h2>
          <button 
            onClick={fetchOverview} 
            disabled={isLoading}
            className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
          >
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            Refresh
          </button>
        </div>
        
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-muted-foreground text-sm">Querying Sepolia Smart Contracts...</span>
          </div>
        ) : error ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-destructive">
            <AlertCircle className="w-10 h-10" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        ) : !data || data.pools.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            No active liquidity pools found on Sepolia. Create a pool by adding liquidity!
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-sm uppercase tracking-wider">
                  <th className="pb-4 font-medium">Pool Pair</th>
                  <th className="pb-4 font-medium">Contract Address</th>
                  <th className="pb-4 font-medium text-right">Pool TVL</th>
                  <th className="pb-4 font-medium text-right">Total LP Supply</th>
                </tr>
              </thead>
              <tbody>
                {data.pools.map((pool) => (
                  <tr key={pool.pairAddress} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-4 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary z-10 border-2 border-card">
                          {pool.token0Symbol.slice(0, 3)}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary border-2 border-card">
                          {pool.token1Symbol.slice(0, 3)}
                        </div>
                      </div>
                      <span className="font-semibold">
                        {pool.token0Symbol} / {pool.token1Symbol}
                        <span className="text-muted-foreground font-normal ml-1 border border-border px-1 text-[10px]">0.3%</span>
                      </span>
                    </td>
                    <td className="py-4 text-xs font-mono text-muted-foreground">
                      <a 
                        href={`https://sepolia.etherscan.io/address/${pool.pairAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline"
                      >
                        {pool.pairAddress.slice(0, 6)}...{pool.pairAddress.slice(-6)}
                      </a>
                    </td>
                    <td className="py-4 text-right font-medium">{formatTVL(pool.tvl)}</td>
                    <td className="py-4 text-right font-medium text-muted-foreground text-xs">
                      {parseFloat(pool.totalSupply) > 0 
                        ? (parseFloat(pool.totalSupply) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 })
                        : '0'} LP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
