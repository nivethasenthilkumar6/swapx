import { ethers } from "ethers";
import { cacheService } from "./cacheService";
import { coinGeckoService } from "./coinGeckoService";

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  chainId: number;
  priceUsd?: number;
  priceChange24h?: number;
}

// ─── Well-known Sepolia Testnet Token Addresses ──────────────────────────────
// Sources:
//   WETH:  Official Sepolia WETH9 (widely used)
//   USDC:  Circle's official Sepolia USDC
//   LINK:  Chainlink's official Sepolia LINK (faucet token)
//   Others: Community-deployed testnet tokens with liquidity
//
// Note: Uniswap Labs does not publish a Sepolia token list; these are the
// verified Sepolia counterparts used in production integrations.
const SEPOLIA_TOKENS: TokenInfo[] = [
  {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    chainId: 11155111,
  },
  {
    address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    chainId: 11155111,
  },
  {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    chainId: 11155111,
  },
  {
    address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    symbol: "LINK",
    name: "Chainlink",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
    chainId: 11155111,
  },
  {
    address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/9956/small/4943.png",
    chainId: 11155111,
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
    chainId: 11155111,
  },
  {
    address: "0x29f2D40B0605204364af54EC677bD022dA425d03",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    logoURI: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
    chainId: 11155111,
  },
];

// Also try to load our own deployed tokens from deploy output (if available)
function loadDeployedTokenAddresses(): Partial<Record<string, string>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const deployed = require("../../../contracts/deployed-addresses.json");
    const overrides: Partial<Record<string, string>> = {};
    if (deployed?.contracts?.WETH) overrides["WETH"] = deployed.contracts.WETH;
    if (deployed?.contracts?.tokens?.USDC) overrides["USDC"] = deployed.contracts.tokens.USDC;
    if (deployed?.contracts?.tokens?.DAI) overrides["DAI"] = deployed.contracts.tokens.DAI;
    if (deployed?.contracts?.tokens?.LINK) overrides["LINK"] = deployed.contracts.tokens.LINK;
    if (deployed?.contracts?.tokens?.UNI) overrides["UNI"] = deployed.contracts.tokens.UNI;
    if (deployed?.contracts?.tokens?.WBTC) overrides["WBTC"] = deployed.contracts.tokens.WBTC;
    return overrides;
  } catch {
    return {};
  }
}

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

class TokenService {
  private provider: ethers.JsonRpcProvider | null = null;

  private getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      const rpcUrl = process.env.RPC_URL || "https://rpc.sepolia.org";
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return this.provider;
  }

  async getTokenList(): Promise<TokenInfo[]> {
    const cacheKey = "token-list-v2";
    const cached = cacheService.get<TokenInfo[]>(cacheKey);
    if (cached) return cached;

    // Start from Sepolia well-known addresses
    const tokens = [...SEPOLIA_TOKENS];

    // Override with our deployed addresses if available (they take precedence for WBTC, etc.)
    const deployed = loadDeployedTokenAddresses();
    for (const token of tokens) {
      const override = deployed[token.symbol];
      if (override && override !== "") {
        token.address = override;
      }
    }

    // Enrich with live CoinGecko price data
    try {
      const market = await coinGeckoService.getMarketPrices();
      for (const token of tokens) {
        const priceData = market.prices[token.symbol];
        if (priceData) {
          token.priceUsd = priceData.usd;
          token.priceChange24h = priceData.usd_24h_change;
        }
      }
    } catch (err) {
      console.warn("Could not fetch CoinGecko prices for token list:", err);
    }

    cacheService.set(cacheKey, tokens, 60_000); // 60s cache
    return tokens;
  }

  // Synchronous version for backward compatibility (without prices)
  getTokenListSync(): TokenInfo[] {
    const cached = cacheService.get<TokenInfo[]>("token-list-v2");
    if (cached) return cached;
    return [...SEPOLIA_TOKENS];
  }

  async searchTokens(query: string): Promise<TokenInfo[]> {
    const tokens = await this.getTokenList();
    const q = query.toLowerCase();
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
    );
  }

  async getTokenInfo(address: string): Promise<TokenInfo | null> {
    const cacheKey = `token-info-${address.toLowerCase()}`;
    const cached = cacheService.get<TokenInfo>(cacheKey);
    if (cached) return cached;

    // Check default list first
    const tokens = await this.getTokenList();
    const known = tokens.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    if (known) return known;

    // Fetch from chain
    try {
      const provider = this.getProvider();
      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);

      const priceUsd = await coinGeckoService.getPriceForSymbol(symbol).catch(() => null);

      const info: TokenInfo = {
        address,
        name,
        symbol,
        decimals: Number(decimals),
        logoURI: `https://assets.coingecko.com/coins/images/generic.png`,
        chainId: 11155111,
        priceUsd: priceUsd ?? undefined,
      };

      cacheService.set(cacheKey, info, 600_000); // 10 min cache
      return info;
    } catch (error) {
      console.error(`Failed to fetch token info for ${address}:`, error);
      return null;
    }
  }
}

export const tokenService = new TokenService();
