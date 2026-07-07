import { Router, Request, Response, NextFunction } from "express";
import { priceService } from "../services/priceService";
import { coinGeckoService } from "../services/coinGeckoService";

export const priceRoutes = Router();

// GET /api/prices/market — live CoinGecko market prices for all tokens
priceRoutes.get("/market", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const symbols = req.query.symbols
      ? (req.query.symbols as string).split(",")
      : undefined;

    const market = await coinGeckoService.getMarketPrices(symbols);

    res.json({
      success: true,
      data: market,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/quote?amountIn=<amount>&path[]=<addr>&path[]=<addr>
priceRoutes.get("/quote", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPath = req.query.path ?? req.query['path[]'];
    const pathArray = Array.isArray(rawPath)
      ? rawPath
      : typeof rawPath === 'string'
      ? [rawPath]
      : [];

    const amountInValue = Array.isArray(req.query.amountIn)
      ? req.query.amountIn[0]
      : req.query.amountIn;

    if (!amountInValue || pathArray.length < 2) {
      res.status(400).json({
        success: false,
        error: "Invalid amountIn or path parameters",
        code: "BAD_REQUEST",
        timestamp: Date.now(),
      });
      return;
    }

    const quote = await priceService.getQuote(amountInValue as string, pathArray as string[]);

    if (!quote) {
      res.status(404).json({
        success: false,
        error: "Could not fetch quote for path",
        code: "NOT_FOUND",
        timestamp: Date.now(),
      });
      return;
    }

    res.json({
      success: true,
      data: quote,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/:tokenA/:tokenB — on-chain reserve-based price
priceRoutes.get("/:tokenA/:tokenB", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenA = req.params.tokenA as string;
    const tokenB = req.params.tokenB as string;
    const data = await priceService.getPrice(tokenA, tokenB);

    if (!data) {
      res.status(404).json({
        success: false,
        error: "Pair not found or no reserves",
        code: "NOT_FOUND",
        timestamp: Date.now(),
      });
      return;
    }

    res.json({
      success: true,
      data,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/history/:tokenA/:tokenB — price history
priceRoutes.get("/history/:tokenA/:tokenB", (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenA = req.params.tokenA as string;
    const tokenB = req.params.tokenB as string;
    const pair = `${tokenA}-${tokenB}`;
    const history = priceService.getPriceHistory(pair);

    res.json({
      success: true,
      data: history,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});
