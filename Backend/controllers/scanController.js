const { ScanService, createHttpError } = require('../services/scanService');

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
  };
}

function createScanController({ scanRepository, scanQueueService, aiValidationService, imageStorageService, auditLogService }) {
  const scanService = new ScanService({
    scanRepository,
    scanQueueService,
    aiValidationService,
    imageStorageService,
    auditLogService,
  });

  return {
    captureScan: async (request, response) => {
      try {
        if (!request.auth || !request.auth.sub) {
          throw createHttpError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const result = await scanService.captureScan(
          {
            ...request.body,
            orgId: request.auth.org_id,
            capturedByUserId: request.auth.sub,
          },
          {
            ...extractRequestMetadata(request),
            role: request.auth.role,
          },
        );

        return response.status(202).json({
          data: result,
        });
      } catch (error) {
        return sendError(response, error);
      }
    },

    processScanJob: async (job) => scanService.processQueuedScan(job),
  };
}

module.exports = {
  createScanController,
};