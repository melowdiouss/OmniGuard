/**
 * CSRF Protection Middleware
 * Implements Double-Submit-Cookie pattern with SameSite enforcement
 */

const crypto = require('crypto');

const CSRF_TOKEN_NAME = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a CSRF token
 * @returns {string} Random 32-byte hex token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create CSRF middleware that generates and validates tokens
 * @param {Object} options - Middleware options
 * @param {boolean} options.strict - Strict mode (validate on all requests)
 * @param {Array<string>} options.exemptMethods - HTTP methods to exempt (default: ['GET', 'HEAD', 'OPTIONS'])
 * @returns {Function} Express middleware
 */
function createCSRFMiddleware(options = {}) {
  const {
    strict = false,
    exemptMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'],
  } = options;

  return (request, response, next) => {
    // Generate and set CSRF token on GET requests
    if (request.method === 'GET') {
      const token = generateCSRFToken();
      response.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JS for form submission
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
      request.csrfToken = token;
      return next();
    }

    // Skip validation for exempt methods
    if (!strict && exemptMethods.includes(request.method.toUpperCase())) {
      request.csrfToken = request.cookies?.[CSRF_COOKIE_NAME] || generateCSRFToken();
      return next();
    }

    // Validate CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method.toUpperCase())) {
      const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
      const headerToken = request.get(CSRF_HEADER_NAME) || request.body?.[CSRF_TOKEN_NAME];

      if (!cookieToken || !headerToken) {
        return response.status(403).json({
          error: {
            message: 'CSRF token is missing',
            code: 'CSRF_TOKEN_MISSING',
          },
        });
      }

      if (cookieToken !== headerToken) {
        return response.status(403).json({
          error: {
            message: 'CSRF token is invalid',
            code: 'CSRF_TOKEN_INVALID',
          },
        });
      }
    }

    return next();
  };
}

/**
 * Middleware to enforce SameSite=Strict on all cookies
 */
function enforceSameSiteCookies(request, response, next) {
  const originalSetCookie = response.setHeader.bind(response);

  response.setHeader = function (name, value) {
    if (name.toLowerCase() === 'set-cookie') {
      if (typeof value === 'string') {
        if (!value.includes('SameSite')) {
          value += '; SameSite=Strict';
        }
      } else if (Array.isArray(value)) {
        value = value.map((v) => (!v.includes('SameSite') ? v + '; SameSite=Strict' : v));
      }
    }
    return originalSetCookie(name, value);
  };

  return next();
}

module.exports = {
  createCSRFMiddleware,
  enforceSameSiteCookies,
  generateCSRFToken,
  CSRF_TOKEN_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
};
