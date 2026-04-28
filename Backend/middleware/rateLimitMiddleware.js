const RATE_LIMIT_CONFIG = Object.freeze({
  requestsPerMinute: 60,
  requestsPerHour: 1000,
});

function extractClientIp(request) {
  return (
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.socket.remoteAddress ||
    'unknown'
  );
}

function createRateLimitStore() {
  const store = new Map();

  return {
    async checkLimit(key, maxRequests, windowSeconds) {
      const now = Date.now();
      const windowMs = windowSeconds * 1000;

      if (!store.has(key)) {
        store.set(key, {
          count: 1,
          windowStart: now,
        });
        return { allowed: true, remaining: maxRequests - 1 };
      }

      const entry = store.get(key);
      const timeSinceWindowStart = now - entry.windowStart;

      if (timeSinceWindowStart > windowMs) {
        store.set(key, {
          count: 1,
          windowStart: now,
        });
        return { allowed: true, remaining: maxRequests - 1 };
      }

      entry.count += 1;
      const allowed = entry.count <= maxRequests;
      const remaining = Math.max(0, maxRequests - entry.count);

      return { allowed, remaining };
    },

    cleanup() {
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;

      for (const [key, entry] of store.entries()) {
        if (now - entry.windowStart > twoMinutes) {
          store.delete(key);
        }
      }
    },
  };
}

const defaultStore = createRateLimitStore();

setInterval(() => {
  defaultStore.cleanup();
}, 60000);

function rateLimitByIp(maxRequests = RATE_LIMIT_CONFIG.requestsPerMinute, windowSeconds = 60) {
  return async (request, response, next) => {
    const clientIp = extractClientIp(request);
    const key = `ip:${clientIp}`;

    const { allowed, remaining } = await defaultStore.checkLimit(key, maxRequests, windowSeconds);

    response.setHeader('X-RateLimit-Limit', maxRequests);
    response.setHeader('X-RateLimit-Remaining', remaining);

    if (!allowed) {
      return response.status(429).json({
        error: {
          message: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: windowSeconds,
        },
      });
    }

    return next();
  };
}

function rateLimitByEmail(maxRequests = 5, windowSeconds = 60) {
  return async (request, response, next) => {
    const email = request.body?.email;

    if (!email) {
      return next();
    }

    const key = `email:${email.toLowerCase().trim()}`;

    const { allowed, remaining } = await defaultStore.checkLimit(key, maxRequests, windowSeconds);

    response.setHeader('X-RateLimit-Limit', maxRequests);
    response.setHeader('X-RateLimit-Remaining', remaining);

    if (!allowed) {
      return response.status(429).json({
        error: {
          message: 'Too many login attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: windowSeconds,
        },
      });
    }

    return next();
  };
}

function rateLimitByUser(maxRequests = RATE_LIMIT_CONFIG.requestsPerMinute, windowSeconds = 60) {
  return async (request, response, next) => {
    if (!request.auth || !request.auth.sub) {
      return next();
    }

    const key = `user:${request.auth.sub}`;

    const { allowed, remaining } = await defaultStore.checkLimit(key, maxRequests, windowSeconds);

    response.setHeader('X-RateLimit-Limit', maxRequests);
    response.setHeader('X-RateLimit-Remaining', remaining);

    if (!allowed) {
      return response.status(429).json({
        error: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: windowSeconds,
        },
      });
    }

    return next();
  };
}

module.exports = {
  rateLimitByIp,
  rateLimitByEmail,
  rateLimitByUser,
  RATE_LIMIT_CONFIG,
  createRateLimitStore,
  extractClientIp,
};
