/**
 * Rate limiting middleware
 */

import rateLimit from "express-rate-limit";

// Store for IP-based rate limiting (in production, use Redis)
const requestCounts = new Map();

/**
 * Get rate limit for IP
 */
const getRateLimit = (ip) => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const requests = requestCounts.get(ip).filter((time) => time > oneHourAgo);
  requestCounts.set(ip, requests);

  return requests.length;
};

/**
 * Track request for IP
 */
const trackRequest = (ip) => {
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const requests = requestCounts.get(ip);
  requests.push(Date.now());
  requestCounts.set(ip, requests);
};

/**
 * Rate limit middleware
 */
export const rateLimitMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const limit = 1000; // 1000 conversions per hour per IP (generous for testing)

  const count = getRateLimit(ip);

  if (count >= limit) {
    return res.status(429).json({
      error: "Too many requests. Please try again later.",
      retryAfter: 3600
    });
  }

  // Track this request
  trackRequest(ip);

  next();
};

/**
 * More aggressive rate limit for specific endpoints
 */
export const strictRateLimitMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const limit = 1000; // 1000 requests per hour (generous for testing)

  const count = getRateLimit(ip);

  if (count >= limit) {
    return res.status(429).json({
      error: "Too many requests. Please try again later.",
      retryAfter: 3600
    });
  }

  next();
};

export default rateLimitMiddleware;
