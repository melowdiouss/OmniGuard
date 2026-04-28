/**
 * Authentication Routes
 * Implements complete auth flow with security hardening
 */

const express = require('express');
const {
  createAuthMiddleware,
  authorizeRoles,
  requireOrgId,
  requireEmailVerified,
} = require('../middleware/authMiddleware');
const { createCSRFMiddleware } = require('../middleware/csrfMiddleware');
const { createIPRateLimitMiddleware } = require('../middleware/ipRateLimitMiddleware');
const { ROLES } = require('../constants/roles');

function createAuthRoutes({
  authController,
  userRepository,
  tokenRevocationService,
  auditLogService,
  redisClient,
}) {
  const router = express.Router();

  // Create middleware
  const authenticate = createAuthMiddleware({
    userRepository,
    tokenRevocationService,
    auditLogService,
  });

  const csrf = createCSRFMiddleware({ strict: false });

  // IP-based rate limiting (100 requests per 15 minutes per IP)
  const ipRateLimit = createIPRateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    redisClient,
  });

  // Stricter rate limiting for sensitive endpoints (10 per 15 min)
  const sensitiveEndpointRateLimit = createIPRateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    redisClient,
    keyPrefix: 'sensitive-rl:',
  });

  router.get('/csrf', csrf, async (request, response) => {
    return response.status(200).json({
      data: {
        csrfToken: request.csrfToken,
      },
    });
  });

  // ============================================
  // PUBLIC ENDPOINTS (No Authentication)
  // ============================================

  /**
   * POST /auth/register
   * Register a new user
   * Body: { email, password, role, orgId }
   * Response: { data: { user, accessToken, refreshToken, emailVerificationRequired } }
   */
  router.post(
    '/register',
    ipRateLimit,
    sensitiveEndpointRateLimit,
    csrf,
    async (request, response) => {
      return authController.register(request, response);
    },
  );

  /**
   * POST /auth/login
   * Authenticate user and get tokens
   * Body: { email, password }
   * Response: { data: { user, accessToken, refreshToken } }
   */
  router.post(
    '/login',
    ipRateLimit,
    sensitiveEndpointRateLimit,
    csrf,
    async (request, response) => {
      return authController.login(request, response);
    },
  );

  /**
   * POST /auth/refresh
   * Rotate access token using refresh token
   * Body: { refreshToken }
   * Response: { data: { user, accessToken, refreshToken } }
   * SECURITY: Old refresh token is revoked immediately
   */
  router.post(
    '/refresh',
    ipRateLimit,
    csrf,
    async (request, response) => {
      return authController.refresh(request, response);
    },
  );

  /**
   * POST /auth/request-password-reset
   * Request password reset email
   * Body: { email }
   * Response: { data: { success, message } }
   * SECURITY: Doesn't reveal whether email exists (prevents user enumeration)
   */
  router.post(
    '/request-password-reset',
    ipRateLimit,
    sensitiveEndpointRateLimit,
    csrf,
    async (request, response) => {
      return authController.requestPasswordReset(request, response);
    },
  );

  /**
   * POST /auth/reset-password
   * Reset password with verification token
   * Body: { email, token, newPassword }
   * Response: { data: { success, message } }
   * SECURITY: All tokens revoked for user on reset
   */
  router.post(
    '/reset-password',
    ipRateLimit,
    sensitiveEndpointRateLimit,
    csrf,
    async (request, response) => {
      return authController.resetPassword(request, response);
    },
  );

  // ============================================
  // AUTHENTICATED ENDPOINTS (Require Valid Token)
  // ============================================

  /**
   * GET /auth/me
   * Get current user info
   * Headers: Authorization: Bearer <accessToken>
   * Response: { data: { user } }
   */
  router.get(
    '/me',
    authenticate,
    requireOrgId(),
    ipRateLimit,
    async (request, response) => {
      return authController.me(request, response);
    },
  );

  /**
   * POST /auth/verify-email
   * Verify user's email with token
   * Headers: Authorization: Bearer <accessToken>
   * Body: { email, token }
   * Response: { data: { success, message } }
   * NOTE: Token must be valid but email verification is not enforced for access
   */
  router.post(
    '/verify-email',
    authenticate,
    requireOrgId(),
    ipRateLimit,
    csrf,
    async (request, response) => {
      return authController.verifyEmail(request, response);
    },
  );

  /**
   * POST /auth/logout
   * Logout and revoke token
   * Headers: Authorization: Bearer <accessToken>
   * Response: { data: { success, message } }
   * SECURITY: JTI added to blacklist immediately
   */
  router.post(
    '/logout',
    authenticate,
    requireOrgId(),
    csrf,
    async (request, response) => {
      try {
        const { jti } = request.auth;

        if (tokenRevocationService && jti) {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          await tokenRevocationService.addToBlacklist(jti, expiresAt);
        }

        if (auditLogService) {
          await auditLogService.logAuthEvent(
            'LOGOUT',
            request.auth.sub,
            request.auth.org_id,
            'SUCCESS',
            request.ip || request.connection?.remoteAddress,
            request.get('user-agent'),
          );
        }

        return response.status(200).json({
          data: {
            success: true,
            message: 'Logged out successfully',
          },
        });
      } catch (error) {
        return response.status(500).json({
          error: {
            message: 'Logout failed',
            code: 'LOGOUT_ERROR',
          },
        });
      }
    },
  );

  // ============================================
  // ROLE-BASED ENDPOINTS (Require Specific Role)
  // ============================================

  /**
   * GET /auth/admin/users
   * List all users (ADMIN only)
   * Headers: Authorization: Bearer <accessToken>
   * Response: { data: { users } }
   * SECURITY: Admin role usage is audited
   */
  router.get(
    '/admin/users',
    authenticate,
    authorizeRoles(ROLES.ADMIN),
    requireOrgId(),
    ipRateLimit,
    async (request, response) => {
      // Implementation depends on admin controller
      return response.status(501).json({
        error: { message: 'Not implemented', code: 'NOT_IMPLEMENTED' },
      });
    },
  );

  /**
   * GET /auth/admin/audit-logs
   * View audit logs (ADMIN only)
   * Headers: Authorization: Bearer <accessToken>
   * Query: ?startDate=ISO_DATE&endDate=ISO_DATE&userId=UUID
   * Response: { data: { auditLogs } }
   * SECURITY: All admin access is audited
   */
  router.get(
    '/admin/audit-logs',
    authenticate,
    authorizeRoles(ROLES.ADMIN),
    requireOrgId(),
    ipRateLimit,
    async (request, response) => {
      // Implementation depends on audit controller
      return response.status(501).json({
        error: { message: 'Not implemented', code: 'NOT_IMPLEMENTED' },
      });
    },
  );

  return router;
}

module.exports = {
  createAuthRoutes,
};
