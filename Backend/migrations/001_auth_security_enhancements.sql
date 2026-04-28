-- Migration: Auth System Security Enhancements
-- Description: Adds tables and constraints for token revocation, token cleanup, and user-level token revocation
-- Date: 2026-04-28

-- 1. Add UNIQUE constraint to token_blacklist JTI for idempotency
ALTER TABLE token_blacklist 
  ADD CONSTRAINT uk_token_blacklist_jti UNIQUE (jti);

-- 2. Create index on token_blacklist for fast lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti 
  ON token_blacklist(jti);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires 
  ON token_blacklist(expires_at DESC);

-- 3. Create token_revocation_events table for user-level token revocation
-- This allows revoking ALL tokens for a user (e.g., on password reset)
CREATE TABLE IF NOT EXISTS token_revocation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token_revocation_user_id (user_id),
  INDEX idx_token_revocation_created (created_at DESC)
);

-- 4. Update users table with missing security fields if not present
-- (These should already exist from previous migrations but this ensures idempotency)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'failed_login_attempts') THEN
    ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'account_locked_until') THEN
    ALTER TABLE users ADD COLUMN account_locked_until TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
    ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'email_verified_at') THEN
    ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'org_id') THEN
    ALTER TABLE users ADD COLUMN org_id UUID NOT NULL;
  END IF;
END $$;

-- 5. Add indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at 
  ON users(deleted_at);

CREATE INDEX IF NOT EXISTS idx_users_email_deleted 
  ON users(email, deleted_at);

-- 6. Create audit logs table if not present
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  user_id UUID,
  org_id UUID,
  status VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user_org 
  ON auth_audit_logs(user_id, org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created 
  ON auth_audit_logs(created_at DESC);

-- 7. Add partitioning to token_blacklist for better performance
-- Archive old revoked tokens monthly
CREATE TABLE IF NOT EXISTS token_blacklist_archive (
  LIKE token_blacklist
);

-- 8. Create function to automatically cleanup expired tokens (called hourly)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM token_blacklist WHERE expires_at <= NOW();
  DELETE FROM token_revocation_events WHERE expires_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to auto-archive and cleanup
CREATE OR REPLACE FUNCTION archive_and_cleanup_revoked_tokens()
RETURNS void AS $$
BEGIN
  -- Archive tokens expired more than 30 days ago
  INSERT INTO token_blacklist_archive 
  SELECT * FROM token_blacklist 
  WHERE expires_at <= NOW() - INTERVAL '30 days';
  
  -- Delete archived tokens
  DELETE FROM token_blacklist 
  WHERE expires_at <= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
