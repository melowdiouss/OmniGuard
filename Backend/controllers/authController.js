const { AuthService, createHttpError } = require('../services/authService');

function sendError(response, error) {
  const statusCode = error.statusCode || 500;
  const payload = {
    error: {
      message: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
    },
  };

  return response.status(statusCode).json(payload);
}

function extractRequestMetadata(request) {
  return {
    ipAddress: request.ip || request.connection.remoteAddress,
    userAgent: request.get('user-agent') || null,
  };
}

function createAuthController({
  userRepository,
  rateLimitService,
  accountLockoutService,
  emailVerificationService,
  auditLogService,
}) {
  const authService = new AuthService({
    userRepository,
    rateLimitService,
    accountLockoutService,
    emailVerificationService,
    auditLogService,
  });

  return {
    register: async (request, response) => {
      try {
        const result = await authService.register(request.body);
        return response.status(201).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },

    login: async (request, response) => {
      try {
        const metadata = extractRequestMetadata(request);
        const result = await authService.login(request.body, metadata);
        return response.status(200).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },

    me: async (request, response) => {
      try {
        if (!request.auth || !request.auth.sub) {
          throw createHttpError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const user = await authService.getCurrentUser(request.auth.sub);

        return response.status(200).json({
          data: user,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },

    verifyEmail: async (request, response) => {
      try {
        if (!request.auth || !request.auth.sub) {
          throw createHttpError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const { email, token } = request.body;

        if (!email || !token) {
          throw createHttpError(400, 'Email and token are required', 'MISSING_PARAMS');
        }

        const result = await authService.verifyEmail(request.auth.sub, email, token);

        return response.status(200).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },

    refresh: async (request, response) => {
      try {
        const { refreshToken } = request.body;
        if (!refreshToken) {
          throw createHttpError(400, 'Refresh token is required', 'REFRESH_TOKEN_REQUIRED');
        }

        const metadata = extractRequestMetadata(request);
        const result = await authService.refreshAccessToken(refreshToken, metadata);

        return response.status(200).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },

    requestPasswordReset: async (request, response) => {
      try {
        const { email } = request.body;
        if (!email) {
          throw createHttpError(400, 'Email is required', 'EMAIL_REQUIRED');
        }

        const metadata = extractRequestMetadata(request);
        const result = await authService.requestPasswordReset(email, metadata);

        return response.status(200).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },

    resetPassword: async (request, response) => {
      try {
        const { email, token, newPassword } = request.body;

        if (!email || !token || !newPassword) {
          throw createHttpError(
            400,
            'Email, token, and newPassword are required',
            'MISSING_PARAMS',
          );
        }

        const metadata = extractRequestMetadata(request);
        const result = await authService.resetPassword(email, token, newPassword, metadata);

        return response.status(200).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },
  };
}

module.exports = {
  createAuthController,
};