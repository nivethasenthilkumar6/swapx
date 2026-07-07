import { createConfig, http } from 'wagmi';
import { sepolia, hardhat } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

const rpcUrl = import.meta.env.VITE_RPC_URL || "https://rpc.sepolia.org";

export const config = createConfig({
  chains: [sepolia, hardhat],
  connectors: [
    injected(), // MetaMask, Rabby, etc.
  ],
  transports: {
    [sepolia.id]: http(rpcUrl),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
});
