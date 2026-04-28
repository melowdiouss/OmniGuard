const { ROLES, isValidRole } = require('../constants/roles');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

class User {
  constructor({
    id,
    email,
    passwordHash,
    role,
    orgId,
    isActive = true,
    emailVerifiedAt = null,
    failedLoginAttempts = 0,
    accountLockedUntil = null,
    createdAt = null,
    updatedAt = null,
    lastLoginAt = null,
  }) {
    const normalizedRole = String(role || '').trim().toUpperCase();

    if (!id) {
      throw new Error('User id is required');
    }

    if (!normalizeEmail(email)) {
      throw new Error('User email is required');
    }

    if (!isValidRole(normalizedRole)) {
      throw new Error(`Unsupported role: ${role}`);
    }

    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    this.id = id;
    this.email = normalizeEmail(email);
    this.passwordHash = passwordHash || null;
    this.role = normalizedRole;
    this.orgId = orgId;
    this.isActive = Boolean(isActive);
    this.emailVerifiedAt = emailVerifiedAt;
    this.failedLoginAttempts = Number.parseInt(failedLoginAttempts || '0', 10);
    this.accountLockedUntil = accountLockedUntil;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.lastLoginAt = lastLoginAt;
  }

  static fromRow(row) {
    if (!row) {
      return null;
    }

    return new User({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash ?? row.passwordHash ?? null,
      role: row.role_code ?? row.role,
      orgId: row.org_id ?? row.orgId,
      isActive: row.is_active ?? row.isActive ?? true,
      emailVerifiedAt: row.email_verified_at ?? row.emailVerifiedAt ?? null,
      failedLoginAttempts: row.failed_login_attempts ?? row.failedLoginAttempts ?? 0,
      accountLockedUntil: row.account_locked_until ?? row.accountLockedUntil ?? null,
      createdAt: row.created_at ?? row.createdAt ?? null,
      updatedAt: row.updated_at ?? row.updatedAt ?? null,
      lastLoginAt: row.last_login_at ?? row.lastLoginAt ?? null,
    });
  }

  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      orgId: this.orgId,
      isActive: this.isActive,
      emailVerified: this.emailVerifiedAt !== null && this.emailVerifiedAt !== undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
    };
  }

  toAuthClaims() {
    return {
      sub: String(this.id),
      email: this.email,
      role: this.role,
      org_id: String(this.orgId),
    };
  }
}

module.exports = {
  User,
  ROLES,
  normalizeEmail,
};