// ─── Token Types ─────────────────────────────────────────────────────
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isNative?: boolean;
}

// ─── Pool Types ──────────────────────────────────────────────────────
export interface Pool {
  pairAddress: string;
  tokenA: Token;
  tokenB: Token;
  reserveA: string;
  reserveB: string;
  totalSupply: string;
  spotPrice: string;
  tvl: string;
  fee: number;
}

export interface LPPosition {
  pool: Pool;
  lpBalance: string;
  totalSupply: string;
  sharePercent: string;
  tokenAAmount: string;
  tokenBAmount: string;
}

// ─── Swap Types ──────────────────────────────────────────────────────
export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  minReceived: string;
  priceImpact: string;
  executionPrice: string;
  lpFee: string;
  protocolFee: string;
  gasFee: string;
  totalCost: string;
  path: string[];
  route: string;
}

export interface SwapSettings {
  slippageBps: number;
  deadlineMinutes: number;
  autoRouting: boolean;
}

export type SwapType =
  | "exactETHForTokens"
  | "exactTokensForETH"
  | "exactTokensForTokens"
  | "tokensForExactTokens"
  | "ETHForExactTokens"
  | "tokensForExactETH";

// ─── Transaction Types ──────────────────────────────────────────────
export interface Transaction {
  hash: string;
  type: "swap" | "addLiquidity" | "removeLiquidity" | "approve";
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
  from: string;
  to: string;
  tokenIn?: Token;
  tokenOut?: Token;
  amountIn?: string;
  amountOut?: string;
  gasUsed?: string;
  blockNumber?: number;
}

// ─── Analytics Types ─────────────────────────────────────────────────
export interface ProtocolStats {
  totalPools: number;
  totalTVL: string;
  totalVolume24h: string;
  totalFees24h: string;
  totalTransactions: number;
}

export interface PoolAnalytics {
  pool: Pool;
  volume24h: string;
  fees24h: string;
  tvlChange24h: string;
  priceChange24h: string;
  txCount24h: number;
}

export interface ArbitrageOpportunity {
  tokenA: Token;
  tokenB: Token;
  priceDiffBps: number;
  estimatedProfit: string;
  pool1Price: string;
  pool2Price: string;
  warning: string;
}

// ─── Price Types ─────────────────────────────────────────────────────
export interface PricePoint {
  timestamp: number;
  price: string;
  volume: string;
}

export interface PriceHistory {
  pair: string;
  points: PricePoint[];
  currentPrice: string;
  change24h: string;
  high24h: string;
  low24h: string;
}

// ─── Network Types ───────────────────────────────────────────────────
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contracts: ContractAddresses;
}

export interface ContractAddresses {
  router: string;
  factory: string;
  weth: string;
  swapRouter: string;
  swapHelper: string;
  liquidityManager: string;
}

// ─── Fee Tiers ───────────────────────────────────────────────────────
export interface FeeTier {
  value: number;
  label: string;
  description: string;
}

// ─── API Response Types ──────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
