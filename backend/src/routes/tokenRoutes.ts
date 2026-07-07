import { Router, Request, Response, NextFunction } from "express";
import { tokenService } from "../services/tokenService";

export const tokenRoutes = Router();

// GET /api/tokens — returns all Sepolia tokens with live CoinGecko prices
tokenRoutes.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await tokenService.getTokenList();
    res.json({
      success: true,
      data: tokens,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tokens/search?q=<query>
tokenRoutes.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.json({ success: true, data: [], timestamp: Date.now() });
      return;
    }

    const tokens = await tokenService.searchTokens(query);
    res.json({
      success: true,
      data: tokens,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tokens/:address — fetch token info by contract address
tokenRoutes.get("/:address", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.params.address as string;
    const info = await tokenService.getTokenInfo(address);

    if (!info) {
      res.status(404).json({
        success: false,
        error: "Token not found",
        code: "NOT_FOUND",
        timestamp: Date.now(),
      });
      return;
    }

    res.json({
      success: true,
      data: info,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});
