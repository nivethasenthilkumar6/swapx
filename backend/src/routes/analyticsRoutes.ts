import { Router, Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/analyticsService";

export const analyticsRoutes = Router();

analyticsRoutes.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overview = await analyticsService.getOverview();
    res.json({
      success: true,
      data: overview,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

analyticsRoutes.get("/pools/:tokenA/:tokenB", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenA = req.params.tokenA as string;
    const tokenB = req.params.tokenB as string;
    const poolStats = await analyticsService.getPoolAnalytics(tokenA, tokenB);

    if (!poolStats) {
      res.status(404).json({
        success: false,
        error: "Pool not found",
        code: "NOT_FOUND",
        timestamp: Date.now(),
      });
      return;
    }

    res.json({
      success: true,
      data: poolStats,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

analyticsRoutes.get("/arbitrage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const arbitrage = await analyticsService.detectArbitrage();
    res.json({
      success: true,
      data: arbitrage,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});
