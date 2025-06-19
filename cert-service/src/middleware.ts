import { Request, Response, NextFunction } from 'express';
import { logWithTimestamp, formatErrorResponse } from './utils';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logWithTimestamp('error', `Error ${err.statusCode || 500} - ${err.message}`, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  });

  // Azure SDK errors
  if (err.code === 'ResourceNotFound' || err.statusCode === 404) {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Azure authentication errors
  if (err.code === 'AuthenticationFailed' || err.statusCode === 401) {
    const message = 'Authentication failed';
    error = new AppError(message, 401);
  }

  // Azure authorization errors
  if (err.code === 'AuthorizationFailed' || err.statusCode === 403) {
    const message = 'Insufficient permissions';
    error = new AppError(message, 403);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = 'Invalid input data';
    error = new AppError(message, 400);
  }

  // Network errors
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    const message = 'Service temporarily unavailable';
    error = new AppError(message, 503);
  }

  // Certificate errors
  if (err.message && err.message.includes('certificate')) {
    const message = 'Certificate operation failed';
    error = new AppError(message, 500);
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Internal server error';

  res.status(statusCode).json(formatErrorResponse(error, message));
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const message = `Route ${req.originalUrl} not found`;
  res.status(404).json(formatErrorResponse(new Error(message), message));
}

/**
 * Request validation middleware
 */
export function validateDeviceId(req: Request, res: Response, next: NextFunction): void {
  const { deviceId } = req.params;
  
  if (!deviceId) {
    return next(new AppError('Device ID is required', 400));
  }

  // Validate device ID format
  const deviceIdPattern = /^[a-zA-Z0-9_-]{3,50}$/;
  if (!deviceIdPattern.test(deviceId)) {
    return next(new AppError('Invalid device ID format. Must be 3-50 characters containing only alphanumeric characters, hyphens, and underscores', 400));
  }

  next();
}

/**
 * Request body validation middleware
 */
export function validateRequestBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields = requiredFields.filter(field => !(field in req.body));
    
    if (missingFields.length > 0) {
      return next(new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400));
    }

    next();
  };
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
export function createRateLimiter(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const resetTime = now + windowMs;

    const clientData = requests.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      // Reset window
      requests.set(clientId, { count: 1, resetTime });
      return next();
    }

    if (clientData.count >= maxRequests) {
      return next(new AppError('Too many requests, please try again later', 429));
    }

    // Increment count
    clientData.count++;
    next();
  };
}
