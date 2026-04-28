const express = require('express');
const { ROLES } = require('../constants/roles');

function createProductRoutes({
  productController,
  authenticate,
  authorizeRoles,
  requireOrgId,
  rateLimitMiddleware,
  csrfMiddleware,
} = {}) {
  if (!productController) {
    throw new Error('createProductRoutes requires productController');
  }

  if (typeof authenticate !== 'function') {
    throw new Error('createProductRoutes requires authenticate middleware');
  }

  if (typeof authorizeRoles !== 'function') {
    throw new Error('createProductRoutes requires authorizeRoles middleware');
  }

  if (typeof requireOrgId !== 'function') {
    throw new Error('createProductRoutes requires requireOrgId middleware');
  }

  const router = express.Router();
  const createProductMiddlewares = [];

  if (typeof rateLimitMiddleware === 'function') {
    createProductMiddlewares.push(rateLimitMiddleware);
  }

  if (typeof csrfMiddleware === 'function') {
    createProductMiddlewares.push(csrfMiddleware);
  }

  router.post(
    '/',
    authenticate,
    requireOrgId(),
    authorizeRoles(ROLES.BRAND, ROLES.ADMIN),
    ...createProductMiddlewares,
    async (request, response) => productController.createProduct(request, response),
  );

  return router;
}

module.exports = {
  createProductRoutes,
};
