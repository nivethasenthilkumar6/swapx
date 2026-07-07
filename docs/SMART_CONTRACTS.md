# Smart Contracts

This document explains the core smart contracts used in SwapX.

## Uniswap V2 Architecture
We rely on the standard Uniswap V2 AMM model:
- **Constant Product Formula**: `x * y = k`. The product of the reserves in a pool must remain constant.
- **Factory**: Deploys `IUniswapV2Pair` contracts for each unique pair of ERC20 tokens.
- **Router**: Handles the complex routing logic, allowing users to swap across multiple pairs (e.g., A -> B -> C) and manage liquidity.

## SwapX Wrapper Contracts

To add features without altering the audited Uniswap V2 contracts, we built wrapper contracts.

### SwapRouter.sol
- Wraps the `IUniswapV2Router02` swap functions.
- **Features**:
  - `swapExactETHForTokens`, `swapExactTokensForETH`, `swapExactTokensForTokens`.
  - Slippage protection via `amountOutMin`.
  - Protocol fee collection (up to 0.5%) sent to a fee recipient.
  - `Pausable` to freeze trading in emergencies.

### LiquidityManager.sol
- Wraps the liquidity functions.
- **Features**:
  - `addLiquidity`, `addLiquidityETH`.
  - `removeLiquidity`, `removeLiquidityETH`.
  - Emits custom events for easier indexing.

### SwapHelper.sol
- A pure view contract.
- Queries `IUniswapV2Pair.getReserves()` to calculate current spot prices.
- Analyzes potential arbitrage opportunities by comparing prices across pools (if multiple factories exist).

## Security
- All wrapper contracts use OpenZeppelin's `ReentrancyGuard`, `Ownable`, and `SafeERC20`.
- All methods interacting with ETH use the `payable` modifier securely.
