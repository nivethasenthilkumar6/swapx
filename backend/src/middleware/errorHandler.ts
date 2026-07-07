import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  console.error(`[ERROR] ${statusCode} - ${message}`, err.stack);

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || "INTERNAL_ERROR",
    timestamp: Date.now(),
  });
}

export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code: string = "API_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "ApiError";
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message, "BAD_REQUEST");
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static internal(message: string): ApiError {
    return new ApiError(500, message, "INTERNAL_ERROR");
  }
}
