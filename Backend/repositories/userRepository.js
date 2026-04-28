const { User, normalizeEmail } = require('../models/User');

class UserRepository {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('UserRepository requires a database client with a query method');
    }

    this.db = db;
  }

  async findById(id) {
    const result = await this.db.query(
      `SELECT
         id,
         email,
         password_hash,
         role_code,
         org_id,
         is_active,
         email_verified_at,
         failed_login_attempts,
         account_locked_until,
         created_at,
         updated_at,
         last_login_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    return User.fromRow(result.rows[0]);
  }

  async findByEmail(email) {
    const result = await this.db.query(
      `SELECT
         id,
         email,
         password_hash,
         role_code,
         org_id,
         is_active,
         email_verified_at,
         failed_login_attempts,
         account_locked_until,
         created_at,
         updated_at,
         last_login_at
       FROM users
       WHERE email = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [normalizeEmail(email)],
    );

    return User.fromRow(result.rows[0]);
  }

  async findByIdAndOrg(id, orgId) {
    const result = await this.db.query(
      `SELECT
         id,
         email,
         password_hash,
         role_code,
         org_id,
         is_active,
         email_verified_at,
         failed_login_attempts,
         account_locked_until,
         created_at,
         updated_at,
         last_login_at
       FROM users
       WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [id, orgId],
    );

    return User.fromRow(result.rows[0]);
  }

  async updatePassword(userId, passwordHash) {
    if (!userId || !passwordHash) {
      throw new Error('User ID and password hash are required');
    }

    const result = await this.db.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING
         id,
         email,
         password_hash,
         role_code,
         org_id,
         is_active,
         email_verified_at,
         failed_login_attempts,
         account_locked_until,
         created_at,
         updated_at,
         last_login_at`,
      [passwordHash, userId],
    );

    return User.fromRow(result.rows[0]);
  }

  async create({ email, passwordHash, role, orgId }) {
    const normalizedEmail = normalizeEmail(email);

    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    const result = await this.db.query(
      `INSERT INTO users (
         email,
         password_hash,
         role_code,
         org_id,
         is_active,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
       RETURNING
         id,
         email,
         password_hash,
         role_code,
         org_id,
         is_active,
         email_verified_at,
         failed_login_attempts,
         account_locked_until,
         created_at,
         updated_at,
         last_login_at`,
      [normalizedEmail, passwordHash, role, orgId],
    );

    return User.fromRow(result.rows[0]);
  }

  async updateLastLoginAt(id) {
    const result = await this.db.query(
      `UPDATE users
       SET last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING
         id,
         email,
         password_hash,
         role_code,
         org_id,
         is_active,
         email_verified_at,
         failed_login_attempts,
         account_locked_until,
         created_at,
         updated_at,
         last_login_at`,
      [id],
    );

    return User.fromRow(result.rows[0]);
  }
}

module.exports = {
  UserRepository,
};