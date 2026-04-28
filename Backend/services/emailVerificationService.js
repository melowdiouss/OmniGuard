const crypto = require('crypto');

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

class EmailVerificationService {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('EmailVerificationService requires a database client');
    }

    this.db = db;
  }

  async createVerificationToken(userId, email) {
    if (!userId || !email) {
      throw new Error('User ID and email are required');
    }

    const token = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const result = await this.db.query(
      `INSERT INTO email_verification_tokens (
         user_id,
         email,
         token,
         expires_at,
         created_at
       ) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET token = $3, expires_at = $4, created_at = NOW()
       RETURNING user_id, token, expires_at`,
      [userId, email.toLowerCase().trim(), token, expiresAt],
    );

    return result.rows[0];
  }

  async verifyToken(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    const result = await this.db.query(
      `SELECT user_id, email, expires_at FROM email_verification_tokens
       WHERE token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [token],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async markEmailAsVerified(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    await this.db.query(
      `DELETE FROM email_verification_tokens WHERE user_id = $1`,
      [userId],
    );

    const result = await this.db.query(
      `UPDATE users
       SET email_verified_at = NOW(),
           is_active = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email_verified_at, is_active`,
      [userId],
    );

    return result.rows[0] || null;
  }

  async cleanupExpiredTokens(olderThanHours = 48) {
    const result = await this.db.query(
      `DELETE FROM email_verification_tokens
       WHERE expires_at < NOW() - INTERVAL '1 hour' * $1`,
      [olderThanHours],
    );

    return result.rowCount;
  }

  async isEmailVerified(userId) {
    if (!userId) {
      return false;
    }

    const result = await this.db.query(
      `SELECT email_verified_at FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );

    return result.rows[0]?.email_verified_at !== null && result.rows[0]?.email_verified_at !== undefined;
  }
}

module.exports = {
  EmailVerificationService,
  generateVerificationToken,
};
