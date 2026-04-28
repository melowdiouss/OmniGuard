class RateLimitService {
  constructor(db, redis = null) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('RateLimitService requires a database client');
    }
    this.db = db;
    this.redis = redis;
  }

  async recordFailedAttempt(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error('Email is required');
    }

    const redisKey = `failed_login:${normalizedEmail}`;

    if (this.redis) {
      await this.redis.incr(redisKey);
      await this.redis.expire(redisKey, 900);
    } else {
      await this.db.query(
        `INSERT INTO login_attempts (email, attempt_type, created_at)
         VALUES ($1, 'FAILED', NOW())`,
        [normalizedEmail],
      );
    }
  }

  async getFailedAttemptCount(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return 0;
    }

    if (this.redis) {
      const redisKey = `failed_login:${normalizedEmail}`;
      const count = await this.redis.get(redisKey);
      return Number.parseInt(count || '0', 10);
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE email = $1 AND attempt_type = 'FAILED' AND created_at > $2`,
      [normalizedEmail, fifteenMinutesAgo],
    );

    return Number.parseInt(result.rows[0]?.count || '0', 10);
  }

  async resetFailedAttempts(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (this.redis) {
      const redisKey = `failed_login:${normalizedEmail}`;
      await this.redis.del(redisKey);
    } else {
      await this.db.query(
        `DELETE FROM login_attempts WHERE email = $1 AND attempt_type = 'FAILED'`,
        [normalizedEmail],
      );
    }
  }

  async isRateLimited(email, maxAttempts = 5) {
    const attempts = await this.getFailedAttemptCount(email);
    return attempts >= maxAttempts;
  }
}

module.exports = {
  RateLimitService,
};
