class TokenBlacklistService {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('TokenBlacklistService requires a database client');
    }

    this.db = db;
  }

  async revokeToken(jti, userId, reason = null) {
    if (!jti || !userId) {
      throw new Error('JTI and user ID are required for token revocation');
    }

    const result = await this.db.query(
      `INSERT INTO token_blacklist (
         jti,
         user_id,
         reason,
         created_at
       ) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (jti) DO NOTHING
       RETURNING jti, user_id, created_at`,
      [jti, userId, reason],
    );

    return result.rows[0] || null;
  }

  async isTokenBlacklisted(jti) {
    if (!jti) {
      return false;
    }

    const result = await this.db.query(
      `SELECT jti FROM token_blacklist WHERE jti = $1 LIMIT 1`,
      [jti],
    );

    return result.rows.length > 0;
  }

  async revokeUserAllTokens(userId, reason = null) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const result = await this.db.query(
      `INSERT INTO token_blacklist (user_id, reason, created_at)
       SELECT $1, $2, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM token_blacklist WHERE user_id = $1
       )
       RETURNING user_id`,
      [userId, reason || 'User revoked all tokens'],
    );

    return result.rowCount > 0;
  }

  async cleanupExpiredEntries(olderThanDays = 40) {
    const result = await this.db.query(
      `DELETE FROM token_blacklist
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [olderThanDays],
    );

    return result.rowCount;
  }
}

module.exports = {
  TokenBlacklistService,
};
