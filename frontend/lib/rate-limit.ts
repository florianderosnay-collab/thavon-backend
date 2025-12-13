/**
 * Simple in-memory rate limiter
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  PASSWORD_RESET: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  WEBHOOK: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  API: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 requests per minute
} as const;

/**
 * Check if a request should be rate limited
 * @param key - Unique identifier for the rate limit (e.g., IP address, user ID, email)
 * @param config - Rate limit configuration
 * @returns Object with `allowed` boolean and `remaining` requests
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // If no entry exists or window has expired, create new entry
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request (IP address or user ID)
 */
export function getRateLimitKey(request: Request, identifier?: string): string {
  // If identifier provided (e.g., email, user ID), use it
  if (identifier) {
    return identifier;
  }

  // Otherwise, use IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  return ip;
}

/**
 * Clean up expired entries (run periodically)
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}


