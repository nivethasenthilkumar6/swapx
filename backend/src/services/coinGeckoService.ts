import { cacheService } from "./cacheService";

// Map token symbols to CoinGecko IDs
const COINGECKO_ID_MAP: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  USDC: "usd-coin",
  DAI: "dai",
  LINK: "chainlink",
  UNI: "uniswap",
  WBTC: "wrapped-bitcoin",
  USDT: "tether",
  AAVE: "aave",
  MATIC: "matic-network",
};

// Reverse map: CoinGecko ID → symbol
const COINGECKO_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COINGECKO_ID_MAP).map(([sym, id]) => [id, sym])
);

export interface CoinGeckoPrice {
  symbol: string;
  usd: number;
  usd_24h_change: number;
  usd_24h_vol: number;
  usd_market_cap: number;
  last_updated_at: number;
}

export interface CoinGeckoMarketData {
  prices: Record<string, CoinGeckoPrice>;
  timestamp: number;
}

class CoinGeckoService {
  private readonly BASE_URL = "https://api.coingecko.com/api/v3";
  private readonly CACHE_TTL = 60_000; // 60s cache (free tier updates every ~60s)

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    const apiKey = process.env.COINGECKO_API_KEY;
    if (apiKey) {
      headers["x-cg-demo-api-key"] = apiKey;
    }
    return headers;
  }

  async getMarketPrices(symbols?: string[]): Promise<CoinGeckoMarketData> {
    const cacheKey = "coingecko-market-prices";
    const cached = cacheService.get<CoinGeckoMarketData>(cacheKey);
    if (cached) return cached;

    try {
      const ids = symbols
        ? symbols.map((s) => COINGECKO_ID_MAP[s.toUpperCase()]).filter(Boolean)
        : Object.values(COINGECKO_ID_MAP);

      const uniqueIds = [...new Set(ids)].join(",");
      const url = `${this.BASE_URL}/simple/price?ids=${uniqueIds}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`;

      const response = await fetch(url, { headers: this.buildHeaders() });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const raw = await response.json() as Record<string, {
        usd: number;
        usd_24h_change: number;
        usd_24h_vol: number;
        usd_market_cap: number;
        last_updated_at: number;
      }>;

      const prices: Record<string, CoinGeckoPrice> = {};

      for (const [geckoId, data] of Object.entries(raw)) {
        const symbol = COINGECKO_SYMBOL_MAP[geckoId];
        if (symbol) {
          prices[symbol] = {
            symbol,
            usd: data.usd ?? 0,
            usd_24h_change: data.usd_24h_change ?? 0,
            usd_24h_vol: data.usd_24h_vol ?? 0,
            usd_market_cap: data.usd_market_cap ?? 0,
            last_updated_at: data.last_updated_at ?? Math.floor(Date.now() / 1000),
          };
        }
      }

      // WETH price = ETH price
      if (prices["ETH"] && !prices["WETH"]) {
        prices["WETH"] = { ...prices["ETH"], symbol: "WETH" };
      }

      const result: CoinGeckoMarketData = { prices, timestamp: Date.now() };
      cacheService.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      console.error("CoinGecko API error:", error);
      // Return empty but cached result to avoid hammering the API on error
      const fallback: CoinGeckoMarketData = { prices: {}, timestamp: Date.now() };
      cacheService.set(cacheKey, fallback, 10_000); // short cache on error
      return fallback;
    }
  }

  async getPriceForSymbol(symbol: string): Promise<number | null> {
    const market = await this.getMarketPrices();
    return market.prices[symbol.toUpperCase()]?.usd ?? null;
  }

  getSymbolForGeckoId(geckoId: string): string | undefined {
    return COINGECKO_SYMBOL_MAP[geckoId];
  }

  getGeckoIdForSymbol(symbol: string): string | undefined {
    return COINGECKO_ID_MAP[symbol.toUpperCase()];
  }
}

export const coinGeckoService = new CoinGeckoService();
