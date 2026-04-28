const { ROLES, isValidRole } = require('../constants/roles');
const { validateEmail, validatePassword } = require('../utils/validators');
const { hashPassword, comparePassword } = require('./passwordService');
const { createTokenPair } = require('./tokenService');

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sanitizeUser(user) {
  return user.toPublicJSON();
}

class AuthService {
  constructor({
    userRepository,
    rateLimitService,
    accountLockoutService,
    emailVerificationService,
    auditLogService,
    tokenRevocationService,
  }) {
    if (!userRepository) {
      throw new Error('AuthService requires a userRepository');
    }

    this.userRepository = userRepository;
    this.rateLimitService = rateLimitService;
    this.accountLockoutService = accountLockoutService;
    this.emailVerificationService = emailVerificationService;
    this.auditLogService = auditLogService;
    this.tokenRevocationService = tokenRevocationService;
  }

  async register({ email, password, role, orgId }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = String(role || '').trim().toUpperCase();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw createHttpError(400, emailValidation.error, 'INVALID_EMAIL');
    }

    if (!password) {
      throw createHttpError(400, 'Password is required', 'PASSWORD_REQUIRED');
    }

    if (!isValidRole(normalizedRole)) {
      throw createHttpError(400, 'Invalid role', 'INVALID_ROLE');
    }

    if (!orgId) {
      throw createHttpError(400, 'Organization ID is required', 'ORG_ID_REQUIRED');
    }

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw createHttpError(409, 'Email is already registered', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(password);

    try {
      const user = await this.userRepository.create({
        email: normalizedEmail,
        passwordHash,
        role: normalizedRole,
        orgId,
      });

      if (this.auditLogService) {
        await this.auditLogService.logAuthEvent('REGISTER', user.id, orgId, 'SUCCESS');
      }

      if (this.emailVerificationService) {
        await this.emailVerificationService.generateVerificationToken(normalizedEmail);
      }

      const tokens = createTokenPair(user);

      return {
        user: sanitizeUser(user),
        ...tokens,
        emailVerificationRequired: true,
      };
    } catch (error) {
      if (error && error.code === '23505') {
        throw createHttpError(409, 'Email is already registered', 'EMAIL_ALREADY_EXISTS');
      }

      throw error;
    }
  }

  async login({ email, password }, metadata = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw createHttpError(400, emailValidation.error, 'INVALID_EMAIL');
    }

    if (!password) {
      throw createHttpError(400, 'Password is required', 'PASSWORD_REQUIRED');
    }

    if (this.rateLimitService) {
      const isRateLimited = await this.rateLimitService.isRateLimited(normalizedEmail);
      if (isRateLimited) {
        throw createHttpError(429, 'Too many failed login attempts, try again later', 'RATE_LIMITED');
      }
    }

    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user || !user.isActive) {
      if (this.rateLimitService && user) {
        await this.rateLimitService.recordFailedAttempt(normalizedEmail);
      }
      throw createHttpError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (this.accountLockoutService) {
      const isLocked = await this.accountLockoutService.isAccountLocked(user.id);
      if (isLocked) {
        throw createHttpError(403, 'Account is locked due to too many failed attempts', 'ACCOUNT_LOCKED');
      }
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      if (this.rateLimitService) {
        await this.rateLimitService.recordFailedAttempt(normalizedEmail);
      }

      if (this.accountLockoutService) {
        await this.accountLockoutService.recordFailedAttempt(user.id);
        const failedAttempts = user.failedLoginAttempts || 0;
        if (failedAttempts >= 4) {
          await this.accountLockoutService.lockAccount(user.id, 30);
        }
      }

      if (this.auditLogService) {
        await this.auditLogService.logAuthEvent(
          'LOGIN_FAILED',
          user.id,
          user.orgId,
          'INVALID_PASSWORD',
          metadata.ipAddress,
          metadata.userAgent,
        );
      }

      throw createHttpError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const updatedUser = await this.userRepository.updateLastLoginAt(user.id);

    if (this.accountLockoutService) {
      await this.accountLockoutService.resetFailedAttempts(user.id);
    }

    if (this.rateLimitService) {
      await this.rateLimitService.resetFailedAttempts(normalizedEmail);
    }

    if (this.auditLogService) {
      await this.auditLogService.logAuthEvent(
        'LOGIN_SUCCESS',
        user.id,
        user.orgId,
        'SUCCESS',
        metadata.ipAddress,
        metadata.userAgent,
      );
    }

    const tokens = createTokenPair(updatedUser);

    return {
      user: sanitizeUser(updatedUser),
      ...tokens,
    };
  }

  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw createHttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return sanitizeUser(user);
  }

  async verifyEmail(userId, email, verificationToken) {
    if (!this.emailVerificationService) {
      throw createHttpError(400, 'Email verification is not enabled', 'EMAIL_VERIFICATION_DISABLED');
    }

    const isValid = await this.emailVerificationService.verifyToken(email, verificationToken);
    if (!isValid) {
      throw createHttpError(400, 'Invalid or expired verification token', 'INVALID_TOKEN');
    }

    await this.emailVerificationService.markEmailAsVerified(userId);
    await this.emailVerificationService.consumeToken(email);

    if (this.auditLogService) {
      const user = await this.userRepository.findById(userId);
      if (user) {
        await this.auditLogService.logAuthEvent('EMAIL_VERIFIED', userId, user.orgId, 'SUCCESS');
      }
    }

    return { success: true, message: 'Email verified successfully' };
  }

  async refreshAccessToken(refreshToken, metadata = {}) {
    if (!refreshToken) {
      throw createHttpError(400, 'Refresh token is required', 'REFRESH_TOKEN_REQUIRED');
    }

    let decoded;
    try {
      const { verifyRefreshToken } = require('./tokenService');
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw createHttpError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.userRepository.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw createHttpError(401, 'User not found or inactive', 'USER_NOT_FOUND');
    }

    // CRITICAL: Revoke old refresh token to prevent reuse
    if (this.tokenRevocationService && decoded.jti) {
      const expiresAt = new Date(decoded.exp * 1000);
      await this.tokenRevocationService.addToBlacklist(decoded.jti, expiresAt);
    }

    const tokens = createTokenPair(user);

    if (this.auditLogService) {
      await this.auditLogService.logAuthEvent(
        'TOKEN_ROTATED',
        user.id,
        user.orgId,
        'SUCCESS',
        metadata.ipAddress,
        metadata.userAgent,
      );
    }

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  }

  async requestPasswordReset(email, metadata = {}) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw createHttpError(400, emailValidation.error, 'INVALID_EMAIL');
    }

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      // Don't reveal whether user exists (security best practice)
      if (this.auditLogService) {
        await this.auditLogService.logAuthEvent(
          'PASSWORD_RESET_REQUESTED',
          null,
          null,
          'USER_NOT_FOUND',
          metadata.ipAddress,
          metadata.userAgent,
        );
      }
      return { success: true, message: 'If email exists, a password reset link has been sent' };
    }

    if (!this.emailVerificationService) {
      throw createHttpError(400, 'Password reset is not enabled', 'PASSWORD_RESET_DISABLED');
    }

    // Reuse email verification token mechanism for password reset
    await this.emailVerificationService.generateVerificationToken(normalizedEmail);

    if (this.auditLogService) {
      await this.auditLogService.logAuthEvent(
        'PASSWORD_RESET_REQUESTED',
        user.id,
        user.orgId,
        'SUCCESS',
        metadata.ipAddress,
        metadata.userAgent,
      );
    }

    return { success: true, message: 'If email exists, a password reset link has been sent' };
  }

  async resetPassword(email, resetToken, newPassword, metadata = {}) {
    if (!this.emailVerificationService) {
      throw createHttpError(400, 'Password reset is not enabled', 'PASSWORD_RESET_DISABLED');
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw createHttpError(400, emailValidation.error, 'INVALID_EMAIL');
    }

    const passwordValidation = require('../utils/validators').validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw createHttpError(400, passwordValidation.error, 'INVALID_PASSWORD');
    }

    const isValid = await this.emailVerificationService.verifyToken(normalizedEmail, resetToken);
    if (!isValid) {
      throw createHttpError(400, 'Invalid or expired password reset token', 'INVALID_RESET_TOKEN');
    }

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw createHttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const newPasswordHash = await hashPassword(newPassword);
    await this.userRepository.updatePassword(user.id, newPasswordHash);
    await this.emailVerificationService.consumeToken(normalizedEmail);

    // Revoke all existing tokens for this user
    if (this.tokenRevocationService) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await this.tokenRevocationService.revokeAllUserTokens(user.id, expiresAt);
    }

    if (this.auditLogService) {
      await this.auditLogService.logAuthEvent(
        'PASSWORD_RESET_SUCCESS',
        user.id,
        user.orgId,
        'SUCCESS',
        metadata.ipAddress,
        metadata.userAgent,
      );
    }

    return { success: true, message: 'Password has been reset successfully' };
  }
}

module.exports = {
  AuthService,
  createHttpError,
  ROLES,
};