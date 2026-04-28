const express = require('express');
const { ROLES } = require('../constants/roles');

function createScanRoutes({
  scanController,
  authenticate,
  authorizeRoles,
  requireOrgId,
  rateLimitMiddleware,
  csrfMiddleware,
} = {}) {
  if (!scanController) {
    throw new Error('createScanRoutes requires scanController');
  }

  if (typeof authenticate !== 'function') {
    throw new Error('createScanRoutes requires authenticate middleware');
  }

  if (typeof authorizeRoles !== 'function') {
    throw new Error('createScanRoutes requires authorizeRoles middleware');
  }

  if (typeof requireOrgId !== 'function') {
    throw new Error('createScanRoutes requires requireOrgId middleware');
  }

  const router = express.Router();
  const extraMiddlewares = [];

  if (typeof rateLimitMiddleware === 'function') {
    extraMiddlewares.push(rateLimitMiddleware);
  }

  if (typeof csrfMiddleware === 'function') {
    extraMiddlewares.push(csrfMiddleware);
  }

  router.post(
    '/',
    authenticate,
    requireOrgId(),
    authorizeRoles(ROLES.BRAND, ROLES.LOGISTICS, ROLES.ADMIN),
    ...extraMiddlewares,
    async (request, response) => scanController.captureScan(request, response),
  );

  return router;
}

module.exports = {
  createScanRoutes,
};