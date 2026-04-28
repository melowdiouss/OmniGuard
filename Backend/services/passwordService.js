const bcrypt = require('bcrypt');
const { getPasswordConfig } = require('../config/auth');
const { validatePassword } = require('../utils/validators');

function assertPasswordStrength(password) {
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return password.trim();
}

async function hashPassword(password) {
  const validatedPassword = assertPasswordStrength(password);
  const { saltRounds } = getPasswordConfig();

  return bcrypt.hash(validatedPassword, saltRounds);
}

async function comparePassword(password, passwordHash) {
  if (typeof passwordHash !== 'string' || !passwordHash) {
    return false;
  }

  const validation = validatePassword(password);
  if (!validation.valid) {
    return false;
  }

  return bcrypt.compare(password.trim(), passwordHash);
}

module.exports = {
  hashPassword,
  comparePassword,
  assertPasswordStrength,
};