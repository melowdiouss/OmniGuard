class AuditLogService {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('AuditLogService requires a database client');
    }

    this.db = db;
  }

  async logAuthEvent({
    eventType,
    userId = null,
    email = null,
    orgId = null,
    ipAddress = null,
    userAgent = null,
    success = null,
    reason = null,
  }) {
    if (!eventType) {
      throw new Error('Event type is required');
    }

    const result = await this.db.query(
      `INSERT INTO auth_audit_log (
         event_type,
         user_id,
         email,
         org_id,
         ip_address,
         user_agent,
         success,
         reason,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id, event_type, created_at`,
      [eventType, userId, email, orgId, ipAddress, userAgent, success, reason],
    );

    return result.rows[0];
  }

  async getAuditTrailForUser(userId, limit = 100, offset = 0) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const result = await this.db.query(
      `SELECT
         id,
         event_type,
         email,
         ip_address,
         user_agent,
         success,
         reason,
         created_at
       FROM auth_audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return result.rows;
  }

  async getFailedLoginAttempts(email, hoursAgo = 24) {
    if (!email) {
      throw new Error('Email is required');
    }

    const result = await this.db.query(
      `SELECT
         id,
         event_type,
         ip_address,
         user_agent,
         reason,
         created_at
       FROM auth_audit_log
       WHERE email = $1
       AND event_type IN ('LOGIN_FAILED', 'LOGIN_ATTEMPT_LOCKED')
       AND created_at > NOW() - INTERVAL '1 hour' * $2
       ORDER BY created_at DESC`,
      [email.toLowerCase().trim(), hoursAgo],
    );

    return result.rows;
  }

  async getSuspiciousActivity(hoursAgo = 1) {
    const result = await this.db.query(
      `SELECT
         id,
         event_type,
         email,
         ip_address,
         user_agent,
         COUNT(*) as attempt_count,
         created_at
       FROM auth_audit_log
       WHERE event_type IN ('LOGIN_FAILED', 'LOGIN_ATTEMPT_LOCKED')
       AND created_at > NOW() - INTERVAL '1 hour' * $1
       GROUP BY ip_address, email
       HAVING COUNT(*) >= 3
       ORDER BY attempt_count DESC`,
      [hoursAgo],
    );

    return result.rows;
  }

  async cleanupOldEntries(olderThanDays = 90) {
    const result = await this.db.query(
      `DELETE FROM auth_audit_log
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [olderThanDays],
    );

    return result.rowCount;
  }
}

module.exports = {
  AuditLogService,
};
