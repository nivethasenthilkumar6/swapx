# System Architecture

SwapX uses a three-tier architecture that separates the frontend UI, the backend API, and the blockchain smart contracts.

## 1. Blockchain Layer (Ethereum Sepolia)
- **Uniswap V2 Core & Periphery**: Standard `UniswapV2Factory` and `UniswapV2Router02` contracts managing the AMM logic.
- **SwapX Wrapper Contracts**:
  - `SwapRouter.sol`: Adds protocol fees, access control, and pauses over the Uniswap Router.
  - `LiquidityManager.sol`: Manages liquidity addition/removal through the Uniswap Router.
  - `SwapHelper.sol`: A read-only contract for fetching prices, reserves, and detecting arbitrage.
- **Mock Tokens**: Deployed for testing purposes (USDC, DAI, LINK, WBTC).

## 2. Backend Layer (Node.js + Express)
The backend is completely read-only. It DOES NOT hold private keys or execute transactions.
It serves as an indexing and caching layer to improve frontend performance.

**Components**:
- **Price Service**: Fetches on-chain prices via the `SwapHelper` contract and caches them.
- **Token Service**: Provides metadata for tokens on the platform.
- **Analytics Service**: Computes TVL and Volume metrics.
- **Cache Layer**: In-memory caching with TTLs to drastically reduce RPC calls to the Sepolia testnet.

## 3. Frontend Layer (React + Vite)
The user interface built with React, Vite, and Tailwind CSS.

**Key Technologies**:
- **Wagmi & Viem**: Used for wallet connection, transaction execution, and reading contract states.
- **TanStack Query**: Data fetching and caching for the frontend.
- **Tailwind CSS**: Styling, with a focus on dark-theme, sharp UI components.

## Data Flow
1. **User Connection**: User connects MetaMask/Rabby via Wagmi.
2. **Browsing**: Frontend requests token lists and prices from the Backend API.
3. **Execution**: When a user swaps, the frontend uses Wagmi to call `SwapRouter.sol` directly on the blockchain. The backend is bypassed for execution.
4. **Events**: The blockchain emits events, which can be picked up by the backend for historical logs.
