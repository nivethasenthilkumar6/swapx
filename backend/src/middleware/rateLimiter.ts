import rateLimit from "express-rate-limit";

export function createRateLimiter() {
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Too many requests, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      timestamp: Date.now(),
    },
  });
}
