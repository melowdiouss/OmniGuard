const { extractBearerToken, verifyAccessTokenWithRevocation } = require('../services/tokenService');
const { ROLES } = require('../constants/roles');

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function createAuthMiddleware({ userRepository, tokenRevocationService, auditLogService }) {
  return async function authenticateToken(request, response, next) {
    try {
      const token = extractBearerToken(request.headers.authorization);

      if (!token) {
        throw createHttpError(401, 'Missing bearer token', 'TOKEN_REQUIRED');
      }

      let decoded;
      if (tokenRevocationService) {
        decoded = await verifyAccessTokenWithRevocation(token);
      } else {
        const { verifyAccessToken } = require('../services/tokenService');
        decoded = verifyAccessToken(token);
      }

      // CRITICAL: Re-validate org context
      if (decoded.org_id && userRepository) {
        const user = await userRepository.findByIdAndOrg(decoded.sub, decoded.org_id);
        if (!user) {
          throw createHttpError(403, 'Invalid org context', 'ORG_CONTEXT_INVALID');
        }

        // CRITICAL: Re-validate role
        if (user.role !== decoded.role) {
          throw createHttpError(401, 'Role has been revoked', 'ROLE_REVOKED');
        }

        // Check for user-level token revocation (password reset, force logout)
        if (tokenRevocationService && decoded.iat) {
          const isUserTokensRevoked = await tokenRevocationService.isUserTokensRevoked(
            decoded.sub,
            new Date(decoded.iat * 1000),
          );
          if (isUserTokensRevoked) {
            throw createHttpError(401, 'All tokens have been revoked for this user', 'TOKENS_REVOKED');
          }
        }
      }

      request.auth = {
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        org_id: decoded.org_id,
        tokenType: decoded.typ || 'access',
        jti: decoded.jti,
        iat: decoded.iat,
      };

      request.auditLogService = auditLogService;

      return next();
    } catch (error) {
      const statusCode = error.name === 'TokenExpiredError' ? 401 : error.statusCode || 401;
      return response.status(statusCode).json({
        error: {
          message:
            error.name === 'TokenExpiredError'
              ? 'Token expired'
              : error.message || 'Unauthorized',
          code:
            error.name === 'TokenExpiredError'
              ? 'TOKEN_EXPIRED'
              : error.code || 'UNAUTHORIZED',
        },
      });
    }
  };
}

function authorizeRoles(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map(
    (role) => String(role || '').trim().toUpperCase(),
  );

  return async (request, response, next) => {
    if (!request.auth || !request.auth.role) {
      return response.status(401).json({
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
    }

    if (normalizedAllowedRoles.length === 0) {
      return next();
    }

    const currentRole = String(request.auth.role).trim().toUpperCase();

    if (currentRole === ROLES.ADMIN) {
      // CRITICAL: Audit admin role usage
      if (request.auditLogService) {
        await request.auditLogService.logAuthEvent(
          'ADMIN_ROLE_USED',
          request.auth.sub,
          request.auth.org_id,
          'SUCCESS',
          request.ip || request.connection?.remoteAddress,
          request.get('user-agent'),
        );
      }
      return next();
    }

    if (!normalizedAllowedRoles.includes(currentRole)) {
      return response.status(403).json({
        error: {
          message: 'Forbidden',
          code: 'FORBIDDEN',
        },
      });
    }

    return next();
  };
}

function requireOrgId() {
  return (request, response, next) => {
    if (!request.auth || !request.auth.org_id) {
      return response.status(401).json({
        error: {
          message: 'Organization context is required',
          code: 'ORG_CONTEXT_REQUIRED',
        },
      });
    }

    return next();
  };
}

function requireEmailVerified() {
  return async (request, response, next) => {
    if (!request.auth || !request.auth.sub) {
      return response.status(401).json({
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
    }

    // Note: This requires userRepository to be available in request context
    if (request.userRepository) {
      const user = await request.userRepository.findById(request.auth.sub);
      if (!user || !user.emailVerifiedAt) {
        return response.status(403).json({
          error: {
            message: 'Email verification is required',
            code: 'EMAIL_NOT_VERIFIED',
          },
        });
      }
    }

    return next();
  };
}

module.exports = {
  createAuthMiddleware,
  authorizeRoles,
  requireOrgId,
  requireEmailVerified,
};