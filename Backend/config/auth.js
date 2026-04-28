function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required auth environment variable: ${name}`);
  }

  return value.trim();
}

function validateJwtSecret(secret, name) {
  const MIN_SECRET_LENGTH = 32; // 256 bits for HS256
  if (Buffer.byteLength(secret) < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} bytes (256 bits). Current: ${Buffer.byteLength(secret)} bytes`,
    );
  }
}

function getJwtConfig() {
  const accessTokenSecret = getRequiredEnv('JWT_ACCESS_SECRET');
  const refreshTokenSecret = getRequiredEnv('JWT_REFRESH_SECRET');
  const issuer = getRequiredEnv('JWT_ISSUER');
  const audience = getRequiredEnv('JWT_AUDIENCE');

  // Validate secret lengths (256+ bits required for HS256)
  validateJwtSecret(accessTokenSecret, 'JWT_ACCESS_SECRET');
  validateJwtSecret(refreshTokenSecret, 'JWT_REFRESH_SECRET');

  return {
    issuer,
    audience,
    algorithm: 'HS256',
    accessTokenSecret,
    refreshTokenSecret,
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  };
}

function getPasswordConfig() {
  const parsedRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

  return {
    saltRounds: Number.isFinite(parsedRounds) && parsedRounds >= 10 ? parsedRounds : 12,
  };
}

module.exports = {
  getJwtConfig,
  getPasswordConfig,
};