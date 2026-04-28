const { OrderTrackingService, createHttpError } = require('../services/orderTrackingService');

function sendError(response, error) {
  const statusCode = error.statusCode || 500;
  return response.status(statusCode).json({
    error: {
      message: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
    },
  });
}

function createOrderTrackingController({ orderRepository, shipmentRepository, scanRepository, auditLogService }) {
  const service = new OrderTrackingService({
    orderRepository,
    shipmentRepository,
    scanRepository,
    auditLogService,
  });

  return {
    viewOrder: async (request, response) => {
      try {
        const order = await service.getOrderForCustomer(request.params.orderId, {
          orgId: request.auth?.org_id,
          userId: request.auth?.sub,
          role: request.auth?.role,
        });

        return response.status(200).json({ data: order });
      } catch (error) {
        return sendError(response, error);
      }
    },

    viewTrackingTimeline: async (request, response) => {
      try {
        const result = await service.getTrackingTimeline(request.params.orderId, {
          orgId: request.auth?.org_id,
          userId: request.auth?.sub,
          role: request.auth?.role,
        }, request.query.limit);

        return response.status(200).json({ data: result });
      } catch (error) {
        return sendError(response, error);
      }
    },

    viewAssignedShipments: async (request, response) => {
      try {
        const result = await service.getAssignedShipments(
          {
            orgId: request.auth?.org_id,
            userId: request.auth?.sub,
            role: request.auth?.role,
          },
          {
            limit: request.query.limit,
            offset: request.query.offset,
          },
        );

        return response.status(200).json({ data: result });
      } catch (error) {
        return sendError(response, error);
      }
    },

    scanPackage: async (request, response) => {
      try {
        const result = await service.scanPackage(request.params.shipmentId, request.body, {
          orgId: request.auth?.org_id,
          userId: request.auth?.sub,
          role: request.auth?.role,
        });

        return response.status(202).json({ data: result });
      } catch (error) {
        return sendError(response, error);
      }
    },
  };
}

module.exports = {
  createOrderTrackingController,
};