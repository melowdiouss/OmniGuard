const express = require('express');
const { ROLES } = require('../constants/roles');

function createOrderTrackingRoutes({
  orderTrackingController,
  authenticate,
  authorizeRoles,
  requireOrgId,
  rateLimitMiddleware,
  csrfMiddleware,
} = {}) {
  if (!orderTrackingController) {
    throw new Error('createOrderTrackingRoutes requires orderTrackingController');
  }

  if (typeof authenticate !== 'function') {
    throw new Error('createOrderTrackingRoutes requires authenticate middleware');
  }

  if (typeof authorizeRoles !== 'function') {
    throw new Error('createOrderTrackingRoutes requires authorizeRoles middleware');
  }

  if (typeof requireOrgId !== 'function') {
    throw new Error('createOrderTrackingRoutes requires requireOrgId middleware');
  }

  const router = express.Router();
  const optionalMiddlewares = [];

  if (typeof rateLimitMiddleware === 'function') {
    optionalMiddlewares.push(rateLimitMiddleware);
  }

  if (typeof csrfMiddleware === 'function') {
    optionalMiddlewares.push(csrfMiddleware);
  }

  router.get(
    '/customer/orders/:orderId',
    authenticate,
    requireOrgId(),
    authorizeRoles(ROLES.CUSTOMER, ROLES.ADMIN),
    ...optionalMiddlewares,
    async (request, response) => orderTrackingController.viewOrder(request, response),
  );

  router.get(
    '/customer/orders/:orderId/tracking',
    authenticate,
    requireOrgId(),
    authorizeRoles(ROLES.CUSTOMER, ROLES.LOGISTICS, ROLES.ADMIN),
    ...optionalMiddlewares,
    async (request, response) => orderTrackingController.viewTrackingTimeline(request, response),
  );

  router.get(
    '/logistics/shipments',
    authenticate,
    requireOrgId(),
    authorizeRoles(ROLES.LOGISTICS, ROLES.ADMIN),
    ...optionalMiddlewares,
    async (request, response) => orderTrackingController.viewAssignedShipments(request, response),
  );

  router.post(
    '/logistics/shipments/:shipmentId/scan',
    authenticate,
    requireOrgId(),
    authorizeRoles(ROLES.LOGISTICS, ROLES.ADMIN),
    ...optionalMiddlewares,
    async (request, response) => orderTrackingController.scanPackage(request, response),
  );

  return router;
}

module.exports = {
  createOrderTrackingRoutes,
};