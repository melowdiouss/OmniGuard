const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }

  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: 'Email format is invalid' };
  }

  if (normalized.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  return { valid: true };
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }

  const trimmed = password.trim();

  if (trimmed.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters' };
  }

  if (!/[a-z]/.test(trimmed)) {
    return { valid: false, error: 'Password must contain lowercase letters' };
  }

  if (!/[A-Z]/.test(trimmed)) {
    return { valid: false, error: 'Password must contain uppercase letters' };
  }

  if (!/\d/.test(trimmed)) {
    return { valid: false, error: 'Password must contain numbers' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(trimmed)) {
    return { valid: false, error: 'Password must contain special characters' };
  }

  const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome'];
  if (commonPasswords.some((p) => trimmed.toLowerCase().includes(p))) {
    return { valid: false, error: 'Password is too common, please choose a stronger one' };
  }

  return { valid: true };
}

module.exports = {
  validateEmail,
  validatePassword,
};
