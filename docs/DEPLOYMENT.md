# Deployment Guide

This guide covers deploying the full SwapX stack to the Sepolia testnet.

## Prerequisites
- Node.js v18+
- Sepolia ETH (from a faucet like Alchemy or Infura)
- An RPC URL (e.g., Alchemy, Infura, or public `https://rpc.sepolia.org`)
- Etherscan API Key for contract verification

## 1. Environment Setup
Rename `.env.example` to `.env` in the root folder.
Populate `PRIVATE_KEY`, `RPC_URL`, and `ETHERSCAN_API_KEY`.

## 2. Deploy Smart Contracts
The deployment script is fully automated. It will:
1. Deploy WETH.
2. Deploy the Uniswap V2 Factory.
3. Deploy the Uniswap V2 Router02.
4. Deploy mock tokens (USDC, DAI, LINK, UNI, WBTC).
5. Deploy SwapX wrappers (SwapRouter, SwapHelper, LiquidityManager).
6. Mint tokens to the deployer.
7. Create pools and seed initial liquidity.
8. Output all addresses to `deployed-addresses.json`.

```bash
cd contracts
npm install
npx hardhat run scripts/deploy.ts --network sepolia
```

## 3. Start Backend
The backend uses the generated `.env` variables to connect to the network.

```bash
cd backend
npm install
npm run dev
```

## 4. Start Frontend
The frontend uses `VITE_` prefixed environment variables.

```bash
cd frontend
npm install
npm run dev
```

Your DEX is now live locally, interacting with the Sepolia blockchain!
