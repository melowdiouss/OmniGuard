class TokenRevocationService {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('TokenRevocationService requires a database client');
    }
    this.db = db;
  }

  async addToBlacklist(jti, expiresAt) {
    if (!jti || typeof jti !== 'string') {
      throw new Error('JTI (JWT ID) is required and must be a string');
    }
    if (!expiresAt || !(expiresAt instanceof Date)) {
      throw new Error('expiresAt must be a valid Date');
    }

    await this.db.query(
      `INSERT INTO token_blacklist (jti, expires_at, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (jti) DO NOTHING`,
      [jti, expiresAt],
    );
  }

  async isBlacklisted(jti) {
    if (!jti) {
      return false;
    }

    const result = await this.db.query(
      `SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW() LIMIT 1`,
      [jti],
    );
    return result.rows.length > 0;
  }

  async removeExpiredEntries() {
    return this.db.query(
      `DELETE FROM token_blacklist WHERE expires_at <= NOW()`,
    );
  }

  async revokeAllUserTokens(userId, expiresAt) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Mark all tokens for this user as revoked by user_id
    // This requires a new table: token_blacklist_user that tracks user-level revocations
    await this.db.query(
      `INSERT INTO token_revocation_events (user_id, expires_at, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET expires_at = $2`,
      [userId, expiresAt],
    );
  }

  async isUserTokensRevoked(userId, tokenIssuedAt) {
    if (!userId || !tokenIssuedAt) {
      return false;
    }

    const result = await this.db.query(
      `SELECT 1 FROM token_revocation_events 
       WHERE user_id = $1 AND created_at > $2 
       LIMIT 1`,
      [userId, tokenIssuedAt],
    );
    return result.rows.length > 0;
  }
}

module.exports = {
  TokenRevocationService,
};
