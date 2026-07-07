export const SWAP_ROUTER_ADDRESS = import.meta.env.VITE_SWAP_ROUTER || '0x961E1ca37AE1D43783ACace5038B709221496036';
export const LIQUIDITY_MANAGER_ADDRESS = import.meta.env.VITE_LIQUIDITY_MANAGER || '0x440384B7C3C35eFcfB5D39D277787b751cAD8040';
export const WETH_ADDRESS = import.meta.env.VITE_WETH || '0x2847EDD59BF140bF8633Cb9Fea8F8b076F51A1b7';
export const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

export const SWAP_ROUTER_ABI = [
  'function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)',
];

export const LIQUIDITY_MANAGER_ABI = [
  'function addLiquidity(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB,uint256 liquidity)',
  'function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256 amountToken,uint256 amountETH,uint256 liquidity)',
];

export function normalizePath(addresses: string[]): string[] {
  return addresses.map((address) => address === NATIVE_ADDRESS ? WETH_ADDRESS : address);
}
