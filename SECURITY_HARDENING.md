# OmniGuard Authentication System - Security Hardening Implementation

## Overview

All vulnerabilities identified in the comprehensive security audit have been implemented. This document summarizes the changes and provides deployment guidance.

---

## Critical Vulnerabilities Fixed

### 1. ✅ JWT Algorithm Confusion & Secret Length Validation

**What was fixed:**
- JWT_ACCESS_SECRET and JWT_REFRESH_SECRET now REQUIRE minimum 32 bytes (256 bits) validation
- JWT_ISSUER and JWT_AUDIENCE now REQUIRED (no defaults allowed)
- Invalid configuration fails at startup, preventing token forgery attacks

**Location:** `src/config/auth.js`

**Configuration Required:**
```bash
# Generate secure secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set environment variables:
JWT_ACCESS_SECRET=<256-bit-hex-string>
JWT_REFRESH_SECRET=<256-bit-hex-string>
JWT_ISSUER=omniguard-api
JWT_AUDIENCE=omniguard-clients
```

---

### 2. ✅ Refresh Token Rotation

**What was fixed:**
- New endpoint: `POST /auth/refresh` rotates access and refresh tokens
- Old refresh token immediately revoked (added to JTI blacklist)
- Prevents indefinite token reuse for 30 days

**Endpoint:**
```
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "data": {
    "user": {...},
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Security Benefit:** Compromised tokens can only be used briefly before auto-revocation during next refresh

---

### 3. ✅ Role Re-validation on Each Request

**What was fixed:**
- Middleware now optionally re-validates user role from database on each request
- If role changed (e.g., admin revoked), token access denied immediately
- Role embedded in JWT is cross-checked against current user record

**Location:** `src/middleware/authMiddleware.js` - `createAuthMiddleware()`

**Implementation:**
```javascript
// Middleware will re-check role if userRepository provided
const authenticate = createAuthMiddleware({
  userRepository,
  tokenRevocationService,
  auditLogService,
});
```

---

### 4. ✅ Org Context Re-validation

**What was fixed:**
- `org_id` from JWT is now verified against user's current org assignment
- New method: `userRepository.findByIdAndOrg(userId, orgId)`
- User cannot access resources outside their organization even with valid token

**Security Benefit:** Cross-org data access is impossible, org isolation enforced at token level

---

### 5. ✅ ADMIN Role Audit Logging

**What was fixed:**
- Every time ADMIN role bypass is exercised, audit event is logged
- `authorizeRoles()` middleware now tracks admin privilege escalation
- Forensic trail of all admin actions recorded with IP + UserAgent

**Audit Event:**
```
event_type: ADMIN_ROLE_USED
user_id: <user_id>
org_id: <org_id>
ip_address: <ip>
user_agent: <browser>
created_at: 2026-04-28T...
```

---

## High Vulnerabilities Fixed

### 6. ✅ No JTI Collision Detection

**What was fixed:**
- `token_blacklist` table now has UNIQUE constraint on JTI
- ON CONFLICT clause prevents duplicate entries
- Database enforces idempotency of JTI revocation

**Migration:**
```sql
ALTER TABLE token_blacklist 
  ADD CONSTRAINT uk_token_blacklist_jti UNIQUE (jti);
```

**Benefit:** Prevents collision attacks, ensures predictable revocation behavior

---

### 7. ✅ Password Reset Flow

**What was fixed:**
- New endpoint: `POST /auth/request-password-reset` - initiate reset
- New endpoint: `POST /auth/reset-password` - complete reset with token
- Password reset tokens expire after 24 hours
- All user tokens revoked on password reset (forces re-login everywhere)
- Rate limited to prevent abuse

**Endpoints:**

```
1. Request password reset (public):
POST /api/v1/auth/request-password-reset
{
  "email": "user@example.com"
}
→ Sends email with reset token (doesn't reveal if user exists)

2. Reset password:
POST /api/v1/auth/reset-password
{
  "email": "user@example.com",
  "token": "32-byte-hex-token",
  "newPassword": "NewP@ssw0rd123"
}
→ Resets password, revokes ALL tokens
```

**Security Benefits:**
- Email enumeration prevented (all requests return same message)
- Token reuse prevented (token consumed after use)
- All active sessions destroyed on reset
- New password must meet complexity requirements

---

### 8. ✅ Logout with Token Revocation

**What was fixed:**
- New endpoint: `POST /auth/logout`
- User's current JWT added to blacklist immediately
- Can't use same token again
- Audit logged with timestamp

**Endpoint:**
```
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>

Response:
{
  "data": {
    "success": true,
    "message": "Logged out successfully"
  }
}
```

---

### 9. ✅ Email Verification Enforcement

**What was fixed:**
- New middleware: `requireEmailVerified()`
- Optional enforcement on protected endpoints
- Prevents unverified users from accessing system

**Usage:**
```javascript
router.get(
  '/protected-endpoint',
  authenticate,
  requireOrgId(),
  requireEmailVerified(),  // ← Enforce email verification
  handler
);
```

---

## Medium Vulnerabilities Fixed

### 10. ✅ CSRF Protection

**What was fixed:**
- New middleware: `createCSRFMiddleware()` - Double-Submit-Cookie pattern
- All state-changing endpoints (POST, PUT, DELETE, PATCH) require CSRF token
- SameSite=Strict enforced on all cookies

**Files:**
- `src/middleware/csrfMiddleware.js`

**Usage:**
```javascript
const csrf = createCSRFMiddleware({ strict: false });

router.post('/auth/login', csrf, authController.login);
```

**How it Works:**
1. Client gets CSRF token on GET request (stored in cookie)
2. Client sends token back in header `X-CSRF-Token` on state-changing requests
3. Server validates cookie token == header token
4. Prevents attacks from unauthorized origins

---

### 11. ✅ IP-Based Rate Limiting

**What was fixed:**
- New middleware: `createIPRateLimitMiddleware()` - tracks requests per IP
- Default: 100 requests per 15 minutes per IP
- Sensitive endpoints: 10 requests per 15 minutes
- Returns `Retry-After` header when limited

**Files:**
- `src/middleware/ipRateLimitMiddleware.js`

**Usage:**
```javascript
const ipRateLimit = createIPRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  redisClient,
});

const sensitiveRateLimit = createIPRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  redisClient,
});

router.post('/auth/login', ipRateLimit, sensitiveRateLimit, authController.login);
```

**Response:**
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Current: 11
X-RateLimit-Remaining: 0
Retry-After: 900

{
  "error": {
    "message": "Too many requests, please try again later",
    "code": "RATE_LIMITED",
    "retryAfter": 900
  }
}
```

---

### 12. ✅ Token Blacklist Cleanup

**What was fixed:**
- Scheduled job automatically removes expired tokens daily at 2 AM
- Prevents database bloat from accumulating blacklist entries
- Archives tokens older than 30 days weekly

**Files:**
- `src/jobs/tokenCleanupScheduler.js`

**Initialization:**
```javascript
const { initializeTokenCleanupJobs } = require('./jobs/tokenCleanupScheduler');

initializeTokenCleanupJobs(tokenRevocationService, logger);
```

**Configuration:**
```env
# cron format: "minute hour day month dayOfWeek"
TOKEN_CLEANUP_SCHEDULE=0 2 * * *      # 2 AM daily
TOKEN_ARCHIVE_SCHEDULE=0 3 * * 0      # 3 AM Sunday
```

---

### 13. ✅ User-Level Token Revocation

**What was fixed:**
- New table: `token_revocation_events` tracks when user's ALL tokens are revoked
- Password reset revokes all tokens for user
- Useful for security incidents (account compromise, forced logout)

**Migration:**
```sql
CREATE TABLE token_revocation_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage:**
```javascript
// Revoke ALL tokens for a user
await tokenRevocationService.revokeAllUserTokens(userId, expiresAt);

// Check if user's tokens were revoked after token issuance
const isRevoked = await tokenRevocationService.isUserTokensRevoked(
  userId,
  new Date(token.iat * 1000)
);
```

---

## Database Schema Changes

Run migration to create all required tables and indexes:

```bash
psql -U user -d omniguard -f src/migrations/001_auth_security_enhancements.sql
```

**New Tables:**
- `token_blacklist` - JTI blacklist
- `token_revocation_events` - User-level token revocation
- `token_blacklist_archive` - Archive for expired tokens
- `email_verification_tokens` - Email verification tokens
- `login_attempts` - Rate limiting tracker
- `auth_audit_logs` - Audit trail

**New Indexes:**
- token_blacklist (jti, expires_at)
- users (deleted_at, email)
- auth_audit_logs (user_id, org_id, created_at)

---

## Environment Configuration

**CRITICAL: Set these before deployment**

```bash
# Generate 256-bit secrets
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Set issuer and audience
JWT_ISSUER=omniguard-api
JWT_AUDIENCE=omniguard-clients

# Database and Redis
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Email
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@omniguard.example.com
```

See `.env.example` for complete configuration options.

---

## Deployment Checklist

- [ ] Copy `.env.example` to `.env` and fill in all values
- [ ] Generate new JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (32+ bytes)
- [ ] Set JWT_ISSUER and JWT_AUDIENCE explicitly
- [ ] Run database migrations: `psql -f src/migrations/001_auth_security_enhancements.sql`
- [ ] Install dependencies: `npm install node-schedule cookie-parser`
- [ ] Test auth flow: register → login → refresh → logout
- [ ] Verify CSRF tokens are issued on GET requests
- [ ] Verify rate limiting triggers after threshold
- [ ] Check audit logs for ADMIN_ROLE_USED events
- [ ] Monitor token cleanup jobs run at scheduled times
- [ ] Load test with IP rate limiting enabled
- [ ] Review security headers in responses

---

## API Routes Summary

| Method | Endpoint | Auth | Rate Limit | CSRF | Description |
|--------|----------|------|-----------|------|-------------|
| POST | `/auth/register` | ❌ | 🔴 | ✅ | Register new user |
| POST | `/auth/login` | ❌ | 🔴 | ✅ | Login and get tokens |
| POST | `/auth/refresh` | ❌ | ✅ | ✅ | Rotate tokens |
| POST | `/auth/logout` | ✅ | ✅ | ✅ | Logout & revoke token |
| POST | `/auth/request-password-reset` | ❌ | 🔴 | ✅ | Request password reset |
| POST | `/auth/reset-password` | ❌ | 🔴 | ✅ | Complete password reset |
| GET | `/auth/me` | ✅ | ✅ | ❌ | Get current user |
| POST | `/auth/verify-email` | ✅ | ✅ | ✅ | Verify email address |

Legend: ✅ = Required/Enabled, ❌ = Not Required, 🔴 = Strict Limit

---

## Testing

### Unit Tests Required
- [ ] JWT secret validation rejects short secrets
- [ ] Role re-validation detects role changes
- [ ] Token rotation revokes old tokens
- [ ] CSRF token validation passes/fails correctly
- [ ] IP rate limiting counts requests accurately
- [ ] Password reset consumes tokens

### Integration Tests Required
- [ ] Full auth flow: register → email verify → login → refresh → logout
- [ ] Role change invalidates active tokens
- [ ] Org context validation prevents cross-org access
- [ ] Password reset revokes all tokens
- [ ] CSRF protection blocks unauthorized origins

### Load Tests Required
- [ ] Rate limiting under high load
- [ ] Token cleanup job completes in <1 second
- [ ] Database connection pooling handles concurrent requests

---

## Monitoring & Alerting

**Metrics to Track:**
- Failed login attempts per IP
- Account lockouts
- Token revocation rate
- Email verification failures
- Password reset requests
- ADMIN role usage frequency
- Rate limit violations

**Alerts to Set Up:**
- > 10 failed logins from single IP
- > 5 accounts locked simultaneously
- Admin role used outside business hours
- CSRF token validation failures spike
- Token cleanup job fails

---

## Security Best Practices

1. **Never log JWT secrets** - Even in debug logs
2. **Rotate secrets periodically** - At least annually
3. **Monitor audit logs daily** - Look for suspicious patterns
4. **Test rate limiting** - Ensure limits are appropriate for your use case
5. **Review ADMIN actions** - Audit all privileged operations
6. **Keep dependencies updated** - Security patches critical
7. **Use HTTPS everywhere** - Required for production
8. **Enable HSTS headers** - Force HTTPS for 1 year
9. **Implement WAF** - Additional layer of protection
10. **Regular security audits** - External penetration testing

---

## Troubleshooting

### Issue: "JWT_ACCESS_SECRET must be at least 32 bytes"

**Solution:** Generate new secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Issue: CSRF token validation failing

**Solution:** Ensure cookies are enabled and SameSite not blocked by browser

### Issue: Rate limiting too strict

**Solution:** Adjust limits in `createIPRateLimitMiddleware()`:
```javascript
const limitMiddleware = createIPRateLimitMiddleware({
  maxRequests: 500,  // Increase from 100
  windowMs: 15 * 60 * 1000
});
```

### Issue: Token cleanup job not running

**Solution:** Ensure `node-schedule` is installed and check logs:
```bash
npm install node-schedule
```

---

## References

- [OWASP JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP CSRF Prevention](https://owasp.org/www-community/attacks/csrf)
- [CWE-294: Authentication Bypass](https://cwe.mitre.org/data/definitions/294.html)
- [CWE-384: Session Fixation](https://cwe.mitre.org/data/definitions/384.html)
