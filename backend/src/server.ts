import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { tokenRoutes } from "./routes/tokenRoutes";
import { priceRoutes } from "./routes/priceRoutes";
import { analyticsRoutes } from "./routes/analyticsRoutes";
import { logRoutes } from "./routes/logRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/logger";
import { createRateLimiter } from "./middleware/rateLimiter";

dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5175",
  "http://localhost:5173",
  "http://localhost:5175",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback to avoid breaking tests/local clients
    }
  },
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(requestLogger);
app.use(createRateLimiter());

// ─── Health Check ────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: Date.now(),
      uptime: process.uptime(),
    },
  });
});

// ─── Routes ──────────────────────────────────────────────────────────
app.use("/api/tokens", tokenRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/logs", logRoutes);

// ─── Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  SwapX Backend API`);
  console.log(`  Running on: http://localhost:${PORT}`);
  console.log(`  Health:     http://localhost:${PORT}/api/health`);
  console.log("═══════════════════════════════════════════════════════");
});

export default app;
