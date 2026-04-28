/**
 * IP-Based Rate Limiting Middleware
 * Prevents brute force attacks on sensitive endpoints
 */

const redis = require('redis');

class IPRateLimiter {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100; // 100 requests
    this.keyPrefix = options.keyPrefix || 'rl:';
  }

  /**
   * Record a request for an IP address
   */
  async recordRequest(ipAddress) {
    const key = `${this.keyPrefix}${ipAddress}`;
    const count = await this.redis.incr(key);

    // Set expiry on first increment
    if (count === 1) {
      await this.redis.expire(key, Math.ceil(this.windowMs / 1000));
    }

    return count;
  }

  /**
   * Get current request count for an IP
   */
  async getRequestCount(ipAddress) {
    const key = `${this.keyPrefix}${ipAddress}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0', 10);
  }

  /**
   * Check if IP is rate limited
   */
  async isRateLimited(ipAddress) {
    const count = await this.getRequestCount(ipAddress);
    return count > this.maxRequests;
  }

  /**
   * Reset counter for an IP
   */
  async resetRequestCount(ipAddress) {
    const key = `${this.keyPrefix}${ipAddress}`;
    await this.redis.del(key);
  }
}

/**
 * Create IP-based rate limit middleware
 * @param {Object} options - Middleware options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Max requests per window
 * @param {Object} options.redisClient - Redis client instance (optional, uses memory fallback)
 * @returns {Function} Express middleware
 */
function createIPRateLimitMiddleware(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    maxRequests = 100,
    redisClient = null,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = null,
  } = options;

  let limiter = null;
  let memoryStore = new Map();

  if (redisClient) {
    limiter = new IPRateLimiter(redisClient, {
      windowMs,
      maxRequests,
      keyPrefix: 'ip-rl:',
    });
  }

  return async (request, response, next) => {
    try {
      const ipAddress = keyGenerator ? keyGenerator(request) : request.ip || request.connection?.remoteAddress;

      if (!ipAddress) {
        // Can't rate limit without IP, allow through
        return next();
      }

      let isLimited = false;
      let count = 0;

      if (limiter) {
        // Use Redis
        count = await limiter.recordRequest(ipAddress);
        isLimited = count > maxRequests;
      } else {
        // Use in-memory fallback
        const key = `${ipAddress}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        if (!memoryStore.has(key)) {
          memoryStore.set(key, []);
        }

        const requests = memoryStore.get(key);
        const validRequests = requests.filter((timestamp) => timestamp > windowStart);
        validRequests.push(now);
        memoryStore.set(key, validRequests);

        count = validRequests.length;
        isLimited = count > maxRequests;

        // Cleanup old entries
        if (memoryStore.size > 10000) {
          memoryStore.clear();
        }
      }

      // Attach rate limit info to request
      request.rateLimit = {
        limit: maxRequests,
        current: count,
        remaining: Math.max(0, maxRequests - count),
      };

      // Add rate limit headers
      response.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Current': count,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - count),
      });

      if (isLimited) {
        // Check if should skip rate limit for this request type
        const statusCode = response.statusCode || 200;
        if (skipSuccessfulRequests && statusCode < 400) {
          return next();
        }
        if (skipFailedRequests && statusCode >= 400) {
          return next();
        }

        // Calculate retry-after time
        const retryAfter = Math.ceil(windowMs / 1000);
        response.set('Retry-After', retryAfter);

        return response.status(429).json({
          error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMITED',
            retryAfter,
          },
        });
      }

      return next();
    } catch (error) {
      // On error, allow request through (fail open for resilience)
      console.error('[IPRateLimit] Error checking rate limit:', error);
      return next();
    }
  };
}

module.exports = {
  IPRateLimiter,
  createIPRateLimitMiddleware,
};
