import type { Token, FeeTier, NetworkConfig } from "./types";

// ─── Chain IDs ───────────────────────────────────────────────────────
export const CHAIN_IDS = {
  SEPOLIA: 11155111,
  HARDHAT: 31337,
} as const;

// ─── Default Network ─────────────────────────────────────────────────
export const DEFAULT_NETWORK: NetworkConfig = {
  chainId: CHAIN_IDS.SEPOLIA,
  name: "Sepolia Testnet",
  rpcUrl: "https://rpc.sepolia.org",
  explorerUrl: "https://sepolia.etherscan.io",
  contracts: {
    router: "",
    factory: "",
    weth: "",
    swapRouter: "",
    swapHelper: "",
    liquidityManager: "",
  },
};

// ─── Native ETH Token ────────────────────────────────────────────────
export const NATIVE_ETH: Token = {
  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  symbol: "ETH",
  name: "Ethereum",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  isNative: true,
};

// ─── Sepolia Testnet Well-Known Token Addresses ──────────────────────
// Sources verified from Chainlink faucet, Circle USDC, and community deployments:
//   WETH:  0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 (official Sepolia WETH9)
//   USDC:  0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (Circle official Sepolia)
//   LINK:  0x779877A7B0D9E8603169DdbD7836e478b4624789 (Chainlink official Sepolia faucet)
//   DAI:   0x68194a729C2450ad26072b3D33ADaCbcef39D574 (community Sepolia DAI)
//   UNI:   0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984 (widely used Sepolia UNI)
//   WBTC:  0x29f2D40B0605204364af54EC677bD022dA425d03 (community Sepolia WBTC)
export const POPULAR_TOKENS: Token[] = [
  NATIVE_ETH,
  {
    address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  },
  {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
  {
    address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/9956/small/4943.png",
  },
  {
    address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    symbol: "LINK",
    name: "Chainlink",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png",
  },
  {
    address: "0x29f2D40B0605204364af54EC677bD022dA425d03",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    logoURI: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
  },
];

// ─── Fee Tiers ───────────────────────────────────────────────────────
export const FEE_TIERS: FeeTier[] = [
  { value: 1, label: "0.01%", description: "Best for very stable pairs" },
  { value: 5, label: "0.05%", description: "Best for stable pairs" },
  { value: 30, label: "0.30%", description: "Best for most pairs" },
  { value: 100, label: "1%", description: "Best for exotic pairs" },
];

// ─── Slippage Presets ────────────────────────────────────────────────
export const SLIPPAGE_PRESETS = [
  { value: 10, label: "0.1%" },
  { value: 50, label: "0.5%" },
  { value: 100, label: "1%" },
] as const;

export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
export const DEFAULT_DEADLINE_MINUTES = 20;
export const MAX_SLIPPAGE_BPS = 5000; // 50%

// ─── Contract Constants ──────────────────────────────────────────────
export const FEE_DENOMINATOR = 10000;
export const PRECISION = BigInt("1000000000000000000"); // 1e18
export const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

// ─── UI Constants ────────────────────────────────────────────────────
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const NATIVE_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const EXPLORER_BASE_URL: Record<number, string> = {
  [CHAIN_IDS.SEPOLIA]: "https://sepolia.etherscan.io",
  [CHAIN_IDS.HARDHAT]: "http://localhost:8545",
};

// ─── Refresh Intervals ──────────────────────────────────────────────
export const REFRESH_INTERVALS = {
  PRICES: 10_000,     // 10 seconds
  BALANCES: 15_000,   // 15 seconds
  POOLS: 30_000,      // 30 seconds
  ANALYTICS: 60_000,  // 60 seconds
} as const;
