import { Router, Request, Response } from "express";

export const logRoutes = Router();

// Mock log data for demonstration
const MOCK_LOGS = [
  {
    type: "swap",
    timestamp: Date.now() - 5000,
    message: "Swapped 1.5 ETH for 3000 USDC",
  },
  {
    type: "liquidity",
    timestamp: Date.now() - 15000,
    message: "Added liquidity: 10 ETH, 20000 USDC",
  },
  {
    type: "swap",
    timestamp: Date.now() - 45000,
    message: "Swapped 500 DAI for 0.25 ETH",
  }
];

logRoutes.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    data: MOCK_LOGS,
    timestamp: Date.now(),
  });
});
