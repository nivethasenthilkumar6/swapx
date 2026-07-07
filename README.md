# SwapX

SwapX is a full-stack decentralized token swapping application, inspired by Uniswap V2, built for the Ethereum Sepolia Testnet.

## Project Structure

This is a monorepo containing:
- `contracts/`: Hardhat project with Solidity smart contracts (Router, Factory wrapper, Liquidity Manager, mock tokens).
- `backend/`: Node.js + Express read-only backend for fetching prices, tokens, and analytics.
- `frontend/`: React + Vite + Tailwind CSS + wagmi frontend interface.
- `shared/`: Shared TypeScript types and constants.
- `docs/`: Comprehensive documentation.

## Features
- **Swap**: Exact ETH for Tokens, Exact Tokens for ETH, Token to Token swaps.
- **Liquidity Pools**: Create pools, add/remove liquidity.
- **Analytics**: Protocol TVL, 24h Volume, Fees, Arbitrage detection.
- **Professional UI**: Dark theme, sharp edges, responsive layout.

## Quick Start

1. Clone the repository and install dependencies in all subfolders:
   ```bash
   cd contracts && npm install
   cd ../backend && npm install
   cd ../frontend && npm install
   ```

2. Copy `.env.example` to `.env` and fill in your RPC URL and Private Key.

3. Deploy Smart Contracts to Sepolia:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.ts --network sepolia
   ```
   This will output addresses and update `.env`.

4. Start Backend:
   ```bash
   cd backend
   npm run dev
   ```

5. Start Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Documentation

For deep dives into the architecture, see the `docs/` folder:
- [Architecture](./docs/ARCHITECTURE.md)
- [Smart Contracts](./docs/SMART_CONTRACTS.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [API Reference](./docs/API.md)
