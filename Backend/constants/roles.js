const ROLES = Object.freeze({
  BRAND: 'BRAND',
  LOGISTICS: 'LOGISTICS',
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

function isValidRole(role) {
  return ROLE_VALUES.includes(role);
}

module.exports = {
  ROLES,
  ROLE_VALUES,
  isValidRole,
};