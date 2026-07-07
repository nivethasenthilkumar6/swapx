import { ethers } from "ethers";
import { cacheService } from "./cacheService";

const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
];

const FACTORY_ABI = [
  "function getPair(address,address) view returns (address)",
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
];

const ROUTER_ABI = [
  "function getAmountsOut(uint256,address[]) view returns (uint256[])",
  "function getAmountsIn(uint256,address[]) view returns (uint256[])",
  "function WETH() view returns (address)",
  "function factory() view returns (address)",
];

const NATIVE_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

interface PriceData {
  price: string;
  reserveA: string;
  reserveB: string;
  timestamp: number;
}

interface PricePoint {
  timestamp: number;
  price: string;
  volume: string;
}

class PriceService {
  private provider: ethers.JsonRpcProvider | null = null;
  private priceHistory: Map<string, PricePoint[]> = new Map();

  private getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      const rpcUrl = process.env.RPC_URL || "https://rpc.sepolia.org";
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return this.provider;
  }

  async getPrice(tokenA: string, tokenB: string): Promise<PriceData | null> {
    const pairKey = `${tokenA}-${tokenB}`.toLowerCase();
    const cached = cacheService.get<PriceData>(`price-${pairKey}`);
    if (cached) return cached;

    try {
      const provider = this.getProvider();
      const factoryAddr = process.env.FACTORY_ADDRESS || "";
      if (!factoryAddr) return null;

      const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, provider);
      const pairAddress = await factory.getPair(tokenA, tokenB);

      if (pairAddress === ethers.ZeroAddress) return null;

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [reserves, token0] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
      ]);

      const [r0, r1] = reserves;
      let reserveA: bigint, reserveB: bigint;

      if (tokenA.toLowerCase() === token0.toLowerCase()) {
        reserveA = r0;
        reserveB = r1;
      } else {
        reserveA = r1;
        reserveB = r0;
      }

      const price = reserveA > 0n
        ? ethers.formatEther((reserveB * ethers.parseEther("1")) / reserveA)
        : "0";

      const data: PriceData = {
        price,
        reserveA: reserveA.toString(),
        reserveB: reserveB.toString(),
        timestamp: Date.now(),
      };

      cacheService.set(`price-${pairKey}`, data, 10_000); // 10s cache

      // Record history
      this.recordPricePoint(pairKey, price);

      return data;
    } catch (error) {
      console.error(`Failed to fetch price for ${tokenA}/${tokenB}:`, error);
      return null;
    }
  }

  async getQuote(
    amountIn: string,
    path: string[]
  ): Promise<{ amountsOut: string[] } | null> {
    try {
      const provider = this.getProvider();
      const routerAddr = process.env.VITE_SWAP_ROUTER || process.env.SWAP_ROUTER_ADDRESS || process.env.ROUTER_ADDRESS || "";
      const wethAddress = process.env.VITE_WETH || process.env.WETH_ADDRESS || "";
      if (!routerAddr || !wethAddress) {
        console.error("Missing router or WETH address for quote service.");
        return null;
      }

      const normalizedPath = path.map((address) =>
        address.toLowerCase() === NATIVE_ADDRESS.toLowerCase() ? wethAddress : address
      );

      if (normalizedPath.length === 2 && normalizedPath[0].toLowerCase() === normalizedPath[1].toLowerCase()) {
        return {
          amountsOut: [amountIn, amountIn],
        };
      }

      const router = new ethers.Contract(routerAddr, ROUTER_ABI, provider);
      const amounts = await router.getAmountsOut(amountIn, normalizedPath);
      if (!Array.isArray(amounts) || amounts.length === 0) {
        return null;
      }

      return {
        amountsOut: amounts.map((a: bigint | string) => a.toString()),
      };
    } catch (error) {
      console.error("Failed to get quote:", error);
      return null;
    }
  }

  getPriceHistory(pair: string): PricePoint[] {
    return this.priceHistory.get(pair.toLowerCase()) || [];
  }

  private recordPricePoint(pairKey: string, price: string): void {
    if (!this.priceHistory.has(pairKey)) {
      this.priceHistory.set(pairKey, []);
    }

    const history = this.priceHistory.get(pairKey)!;
    history.push({
      timestamp: Date.now(),
      price,
      volume: "0",
    });

    // Keep last 1000 points
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }
}

export const priceService = new PriceService();
