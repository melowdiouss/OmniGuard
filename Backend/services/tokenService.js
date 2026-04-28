const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getJwtConfig } = require('../config/auth');

let tokenRevocationService = null;

function setTokenRevocationService(service) {
  tokenRevocationService = service;
}

function buildJwtOptions(type = 'access') {
  const config = getJwtConfig();

  return {
    algorithm: config.algorithm,
    issuer: config.issuer,
    audience: config.audience,
    expiresIn: type === 'refresh' ? config.refreshTokenExpiresIn : config.accessTokenExpiresIn,
  };
}

function getSecret(type = 'access') {
  const config = getJwtConfig();
  return type === 'refresh' ? config.refreshTokenSecret : config.accessTokenSecret;
}

function buildTokenPayload(user, tokenType) {
  return {
    typ: tokenType,
    ...user.toAuthClaims(),
  };
}

function signAccessToken(user) {
  return jwt.sign(buildTokenPayload(user, 'access'), getSecret('access'), {
    ...buildJwtOptions('access'),
    subject: String(user.id),
    jwtid: crypto.randomUUID(),
  });
}

function signRefreshToken(user) {
  return jwt.sign(buildTokenPayload(user, 'refresh'), getSecret('refresh'), {
    ...buildJwtOptions('refresh'),
    subject: String(user.id),
    jwtid: crypto.randomUUID(),
  });
}

function verifyAccessToken(token) {
  const decoded = jwt.verify(token, getSecret('access'), {
    algorithms: [getJwtConfig().algorithm],
    issuer: getJwtConfig().issuer,
    audience: getJwtConfig().audience,
  });

  if (decoded.typ !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }

  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, getSecret('refresh'), {
    algorithms: [getJwtConfig().algorithm],
    issuer: getJwtConfig().issuer,
    audience: getJwtConfig().audience,
  });

  if (decoded.typ !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token');
  }

  return decoded;
}

async function verifyAccessTokenWithRevocation(token) {
  const decoded = verifyAccessToken(token);

  if (tokenRevocationService && decoded.jti) {
    const isBlacklisted = await tokenRevocationService.isBlacklisted(decoded.jti);
    if (isBlacklisted) {
      throw new Error('Token has been revoked');
    }
  }

  return decoded;
}

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim();
}

function createTokenPair(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyAccessTokenWithRevocation,
  extractBearerToken,
  createTokenPair,
  setTokenRevocationService,
};