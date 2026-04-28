const { ProductService, createHttpError } = require('../services/productService');

function sendError(response, error) {
  const statusCode = error.statusCode || 500;
  return response.status(statusCode).json({
    error: {
      message: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
    },
  });
}

function extractRequestMetadata(request) {
  return {
    ipAddress: request.ip || request.connection?.remoteAddress || null,
    userAgent: request.get('user-agent') || null,
    role: request.auth?.role || null,
  };
}

function createProductController({ productRepository, parcelRepository, blockchainService, auditLogService }) {
  const productService = new ProductService({
    productRepository,
    parcelRepository,
    blockchainService,
    auditLogService,
  });

  return {
    createProduct: async (request, response) => {
      try {
        if (!request.auth || !request.auth.sub) {
          throw createHttpError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const result = await productService.createProduct(
          {
            ...request.body,
            orgId: request.auth.org_id,
            createdByUserId: request.auth.sub,
          },
          extractRequestMetadata(request),
        );

        return response.status(201).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },
  };
}

module.exports = {
  createProductController,
};
