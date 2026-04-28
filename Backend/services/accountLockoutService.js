const LOCKOUT_CONFIG = Object.freeze({
  maxAttempts: 5,
  lockoutDurationMinutes: 15,
});

class AccountLockoutService {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('AccountLockoutService requires a database client');
    }

    this.db = db;
  }

  async recordFailedAttempt(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    const result = await this.db.query(
      `INSERT INTO login_attempts (email, success, attempted_at)
       VALUES ($1, FALSE, NOW())
       RETURNING email, attempted_at`,
      [email.toLowerCase().trim()],
    );

    return result.rows[0];
  }

  async recordSuccessfulAttempt(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    await this.db.query(
      `DELETE FROM login_attempts WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    return true;
  }

  async isAccountLocked(email) {
    if (!email) {
      return false;
    }

    const result = await this.db.query(
      `SELECT COUNT(*) as attempt_count,
              MAX(attempted_at) as last_attempt
       FROM login_attempts
       WHERE email = $1
       AND attempted_at > NOW() - INTERVAL '1 minute' * $2`,
      [email.toLowerCase().trim(), LOCKOUT_CONFIG.lockoutDurationMinutes],
    );

    const { attempt_count } = result.rows[0] || { attempt_count: 0 };
    return attempt_count >= LOCKOUT_CONFIG.maxAttempts;
  }

  async getAccountLockoutInfo(email) {
    if (!email) {
      return { isLocked: false, attemptCount: 0, remainingTime: 0 };
    }

    const result = await this.db.query(
      `SELECT COUNT(*) as attempt_count,
              MAX(attempted_at) as last_attempt
       FROM login_attempts
       WHERE email = $1
       AND attempted_at > NOW() - INTERVAL '1 minute' * $2`,
      [email.toLowerCase().trim(), LOCKOUT_CONFIG.lockoutDurationMinutes],
    );

    const { attempt_count, last_attempt } = result.rows[0] || {
      attempt_count: 0,
      last_attempt: null,
    };

    if (attempt_count === 0) {
      return { isLocked: false, attemptCount: 0, remainingTime: 0 };
    }

    const isLocked = attempt_count >= LOCKOUT_CONFIG.maxAttempts;
    const unlockTime = new Date(last_attempt);
    unlockTime.setMinutes(unlockTime.getMinutes() + LOCKOUT_CONFIG.lockoutDurationMinutes);
    const now = new Date();
    const remainingTime = Math.max(0, Math.ceil((unlockTime - now) / 1000 / 60));

    return { isLocked, attemptCount: attempt_count, remainingTime };
  }

  async cleanupExpiredEntries(olderThanHours = 24) {
    const result = await this.db.query(
      `DELETE FROM login_attempts
       WHERE attempted_at < NOW() - INTERVAL '1 hour' * $1`,
      [olderThanHours],
    );

    return result.rowCount;
  }
}

module.exports = {
  AccountLockoutService,
  LOCKOUT_CONFIG,
};
