const crypto = require('crypto');

function hashUserAgent(userAgent) {
  if (!userAgent) {
    return null;
  }

  return crypto.createHash('sha256').update(userAgent).digest('hex');
}

function hashIpAddress(ipAddress) {
  if (!ipAddress) {
    return null;
  }

  return crypto.createHash('sha256').update(ipAddress).digest('hex');
}

function createDeviceFingerprint(ipAddress, userAgent) {
  const combined = `${ipAddress}|${userAgent}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

class DeviceFingerprintService {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('DeviceFingerprintService requires a database client');
    }

    this.db = db;
  }

  async recordDeviceAccess(userId, ipAddress, userAgent) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const fingerprint = createDeviceFingerprint(ipAddress, userAgent);
    const ipHash = hashIpAddress(ipAddress);
    const uaHash = hashUserAgent(userAgent);

    const result = await this.db.query(
      `INSERT INTO device_fingerprints (
         user_id,
         fingerprint,
         ip_address_hash,
         user_agent_hash,
         last_seen_at
       ) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, fingerprint) DO UPDATE
       SET last_seen_at = NOW()
       RETURNING user_id, fingerprint, last_seen_at`,
      [userId, fingerprint, ipHash, uaHash],
    );

    return result.rows[0];
  }

  async isNewDevice(userId, ipAddress, userAgent) {
    if (!userId) {
      return false;
    }

    const fingerprint = createDeviceFingerprint(ipAddress, userAgent);

    const result = await this.db.query(
      `SELECT fingerprint FROM device_fingerprints
       WHERE user_id = $1 AND fingerprint = $2
       LIMIT 1`,
      [userId, fingerprint],
    );

    return result.rows.length === 0;
  }

  async getTrustedDevices(userId) {
    if (!userId) {
      return [];
    }

    const result = await this.db.query(
      `SELECT
         id,
         fingerprint,
         last_seen_at,
         created_at
       FROM device_fingerprints
       WHERE user_id = $1
       ORDER BY last_seen_at DESC
       LIMIT 10`,
      [userId],
    );

    return result.rows;
  }

  async getUnusualAccessPatterns(userId, hoursAgo = 24) {
    if (!userId) {
      return [];
    }

    const result = await this.db.query(
      `SELECT
         fingerprint,
         COUNT(*) as access_count,
         MAX(last_seen_at) as last_seen
       FROM device_fingerprints
       WHERE user_id = $1
       AND last_seen_at > NOW() - INTERVAL '1 hour' * $2
       GROUP BY fingerprint
       ORDER BY access_count DESC`,
      [userId, hoursAgo],
    );

    return result.rows;
  }

  async cleanupOldEntries(olderThanDays = 180) {
    const result = await this.db.query(
      `DELETE FROM device_fingerprints
       WHERE last_seen_at < NOW() - INTERVAL '1 day' * $1`,
      [olderThanDays],
    );

    return result.rowCount;
  }
}

module.exports = {
  DeviceFingerprintService,
  createDeviceFingerprint,
  hashIpAddress,
  hashUserAgent,
};
