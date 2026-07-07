import { ethers } from "ethers";
import { cacheService } from "./cacheService";
import { coinGeckoService } from "./coinGeckoService";

const FACTORY_ABI = [
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
  "function getPair(address,address) view returns (address)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

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

interface ProtocolOverview {
  totalPools: number;
  pools: PoolInfo[];
  totalTvl: string;
  timestamp: number;
}

class AnalyticsService {
  private provider: ethers.JsonRpcProvider | null = null;

  private getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      const rpcUrl = process.env.RPC_URL || "https://rpc.sepolia.org";
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return this.provider;
  }

  async getOverview(): Promise<ProtocolOverview> {
    const cached = cacheService.get<ProtocolOverview>("analytics-overview");
    if (cached) return cached;

    try {
      const provider = this.getProvider();
      const factoryAddr = process.env.FACTORY_ADDRESS || "";
      if (!factoryAddr) {
        return { totalPools: 0, pools: [], totalTvl: "0.00", timestamp: Date.now() };
      }

      const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, provider);
      const totalPools = Number(await factory.allPairsLength());

      const pools: PoolInfo[] = [];
      const maxPools = Math.min(totalPools, 20); // Limit to 20 pools

      // Fetch CoinGecko market prices
      const marketPrices = await coinGeckoService.getMarketPrices().catch(() => ({ prices: {} as Record<string, any> }));
      const prices = (marketPrices.prices || {}) as Record<string, any>;

      for (let i = 0; i < maxPools; i++) {
        try {
          const pairAddress = await factory.allPairs(i);
          const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);

          const [reserves, token0, token1, totalSupply] = await Promise.all([
            pair.getReserves(),
            pair.token0(),
            pair.token1(),
            pair.totalSupply(),
          ]);

          let token0Symbol = "???", token1Symbol = "???";
          let token0Decimals = 18, token1Decimals = 18;
          try {
            const t0 = new ethers.Contract(token0, ERC20_ABI, provider);
            const t1 = new ethers.Contract(token1, ERC20_ABI, provider);
            const [s0, s1, d0, d1] = await Promise.all([
              t0.symbol(),
              t1.symbol(),
              t0.decimals(),
              t1.decimals(),
            ]);
            token0Symbol = s0;
            token1Symbol = s1;
            token0Decimals = Number(d0);
            token1Decimals = Number(d1);
          } catch { /* ignore symbol fetch errors */ }

          // Calculate USD TVL based on CoinGecko prices
          const price0 = prices[token0Symbol.toUpperCase()]?.usd || 0;
          const price1 = prices[token1Symbol.toUpperCase()]?.usd || 0;

          const amount0 = Number(ethers.formatUnits(reserves[0], token0Decimals));
          const amount1 = Number(ethers.formatUnits(reserves[1], token1Decimals));

          const poolTvlValue = (amount0 * price0) + (amount1 * price1);

          pools.push({
            pairAddress,
            token0,
            token1,
            token0Symbol,
            token1Symbol,
            reserve0: reserves[0].toString(),
            reserve1: reserves[1].toString(),
            totalSupply: totalSupply.toString(),
            tvl: poolTvlValue.toFixed(2),
          });
        } catch (error) {
          console.error(`Failed to fetch pool ${i}:`, error);
        }
      }

      let totalTvlVal = 0;
      for (const pool of pools) {
        totalTvlVal += parseFloat(pool.tvl) || 0;
      }

      const overview: ProtocolOverview = {
        totalPools,
        pools,
        totalTvl: totalTvlVal.toFixed(2),
        timestamp: Date.now(),
      };

      cacheService.set("analytics-overview", overview, 60_000); // 1 min cache
      return overview;
    } catch (error) {
      console.error("Failed to fetch analytics overview:", error);
      return { totalPools: 0, pools: [], totalTvl: "0.00", timestamp: Date.now() };
    }
  }

  async getPoolAnalytics(tokenA: string, tokenB: string) {
    const cacheKey = `pool-analytics-${tokenA}-${tokenB}`.toLowerCase();
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      const provider = this.getProvider();
      const factoryAddr = process.env.FACTORY_ADDRESS || "";
      if (!factoryAddr) return null;

      const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, provider);
      const pairAddress = await factory.getPair(tokenA, tokenB);

      if (pairAddress === ethers.ZeroAddress) return null;

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [reserves, token0, totalSupply] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
        pair.totalSupply(),
      ]);

      const data = {
        pairAddress,
        token0,
        reserve0: reserves[0].toString(),
        reserve1: reserves[1].toString(),
        totalSupply: totalSupply.toString(),
        timestamp: Date.now(),
      };

      cacheService.set(cacheKey, data, 30_000); // 30s cache
      return data;
    } catch (error) {
      console.error("Failed to fetch pool analytics:", error);
      return null;
    }
  }

  async detectArbitrage() {
    // Simplified arbitrage detection — compares prices across known pairs
    const overview = await this.getOverview();
    const opportunities: Array<{
      pool1: string;
      pool2: string;
      priceDiff: string;
      warning: string;
    }> = [];

    // In a real implementation, we would compare prices across different DEXes
    // For now, return empty array as we only have one factory
    return {
      opportunities,
      timestamp: Date.now(),
      warning: "Arbitrage detection is for informational purposes only. No automatic execution.",
    };
  }
}

export const analyticsService = new AnalyticsService();
