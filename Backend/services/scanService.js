function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function validateRequiredString(value, fieldName) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw createHttpError(400, `${fieldName} is required`, `${fieldName.toUpperCase()}_REQUIRED`);
  }
  return normalized;
}

function normalizeImages(images) {
  if (!images) {
    return [];
  }

  if (Array.isArray(images)) {
    return images
      .filter(Boolean)
      .map((image, index) => {
        if (typeof image === 'string') {
          return {
            kind: `image_${index + 1}`,
            data: image.trim(),
            mimeType: null,
          };
        }

        if (isPlainObject(image)) {
          return {
            kind: normalizeString(image.kind || image.name || `image_${index + 1}`),
            data: image.data ?? image.content ?? image.base64 ?? image.url ?? null,
            mimeType: normalizeString(image.mimeType || image.mime_type || '') || null,
          };
        }

        throw createHttpError(400, 'Each image must be a string or object', 'INVALID_IMAGE');
      })
      .filter((image) => image.data);
  }

  if (isPlainObject(images)) {
    return Object.entries(images)
      .map(([kind, value]) => {
        if (typeof value === 'string') {
          return { kind, data: value.trim(), mimeType: null };
        }

        if (isPlainObject(value)) {
          return {
            kind,
            data: value.data ?? value.content ?? value.base64 ?? value.url ?? null,
            mimeType: normalizeString(value.mimeType || value.mime_type || '') || null,
          };
        }

        return { kind, data: null, mimeType: null };
      })
      .filter((image) => image.data);
  }

  throw createHttpError(400, 'images must be an array or object', 'INVALID_IMAGES');
}

function sanitizeScan(scan) {
  if (!scan) {
    return null;
  }

  return {
    id: scan.id,
    productId: scan.productId,
    parcelId: scan.parcelId ?? null,
    orgId: scan.orgId,
    scanType: scan.scanType ?? null,
    scanData: scan.scanData ?? null,
    images: scan.images ?? [],
    status: scan.status ?? null,
    validationStatus: scan.validationStatus ?? null,
    validationScore: scan.validationScore ?? null,
    validationResult: scan.validationResult ?? null,
    aiProvider: scan.aiProvider ?? null,
    aiValidatedAt: scan.aiValidatedAt ?? null,
    createdAt: scan.createdAt ?? null,
    updatedAt: scan.updatedAt ?? null,
  };
}

class ScanService {
  constructor({ scanRepository, scanQueueService, aiValidationService, imageStorageService, auditLogService } = {}) {
    if (!scanRepository) {
      throw new Error('ScanService requires a scanRepository');
    }

    if (!scanQueueService) {
      throw new Error('ScanService requires a scanQueueService');
    }

    this.scanRepository = scanRepository;
    this.scanQueueService = scanQueueService;
    this.aiValidationService = aiValidationService;
    this.imageStorageService = imageStorageService;
    this.auditLogService = auditLogService;
  }

  async captureScan(input, metadata = {}) {
    if (!isPlainObject(input)) {
      throw createHttpError(400, 'Request body must be an object', 'INVALID_PAYLOAD');
    }

    const productId = validateRequiredString(input.productId, 'productId');
    const orgId = validateRequiredString(input.orgId, 'orgId');
    const scanType = normalizeString(input.scanType) || 'GENERIC';
    const scanData = input.scanData;

    if (!scanData || (!isPlainObject(scanData) && typeof scanData !== 'string')) {
      throw createHttpError(400, 'scanData is required and must be an object or string', 'SCAN_DATA_REQUIRED');
    }

    const parcelId = normalizeString(input.parcelId) || null;
    const capturedByUserId = normalizeString(input.capturedByUserId) || null;
    const images = normalizeImages(input.images);

    if (images.length === 0) {
      throw createHttpError(400, 'At least one image is required', 'IMAGES_REQUIRED');
    }

    const pendingScan = await this.scanRepository.create({
      productId,
      parcelId,
      orgId,
      scanType,
      scanData,
      images: [],
      status: 'QUEUED',
      validationStatus: 'PENDING',
      createdByUserId: capturedByUserId,
    });

    const job = await this.scanQueueService.enqueue({
      scanId: pendingScan.id,
      productId,
      parcelId,
      orgId,
      scanType,
      scanData,
      images,
      createdByUserId: capturedByUserId,
      metadata,
    });

    if (this.auditLogService) {
      await this.auditLogService.logEvent('SCAN_CAPTURED', {
        userId: capturedByUserId,
        orgId,
        resourceType: 'SCAN',
        resourceId: pendingScan.id,
        details: {
          productId,
          parcelId,
          scanType,
          queuedJobId: job.jobId,
        },
      });
    }

    return {
      scan: sanitizeScan(pendingScan),
      queue: {
        jobId: job.jobId,
        status: 'QUEUED',
      },
    };
  }

  async processQueuedScan(job) {
    if (!isPlainObject(job)) {
      throw createHttpError(400, 'Queue job must be an object', 'INVALID_JOB');
    }

    const scanId = validateRequiredString(job.scanId, 'scanId');
    const scan = await this.scanRepository.findById(scanId);

    if (!scan) {
      throw createHttpError(404, 'Scan not found', 'SCAN_NOT_FOUND');
    }

    const images = normalizeImages(job.images);

    let storedImages = images;
    if (this.imageStorageService) {
      if (typeof this.imageStorageService.storeImages === 'function') {
        storedImages = await this.imageStorageService.storeImages(images, {
          scanId,
          productId: scan.productId,
          parcelId: scan.parcelId,
          orgId: scan.orgId,
        });
      } else if (typeof this.imageStorageService.storeImage === 'function') {
        storedImages = [];
        for (const image of images) {
          const stored = await this.imageStorageService.storeImage(image, {
            scanId,
            productId: scan.productId,
            parcelId: scan.parcelId,
            orgId: scan.orgId,
          });
          storedImages.push(stored);
        }
      }
    }

    if (typeof this.scanRepository.attachImages === 'function') {
      await this.scanRepository.attachImages(scanId, storedImages);
    } else if (typeof this.scanRepository.updateImages === 'function') {
      await this.scanRepository.updateImages(scanId, storedImages);
    }

    let validationOutcome = null;
    if (this.aiValidationService) {
      if (typeof this.aiValidationService.validateScan === 'function') {
        validationOutcome = await this.aiValidationService.validateScan({
          scan: sanitizeScan(scan),
          images: storedImages,
          scanData: job.scanData,
          metadata: job.metadata || {},
        });
      } else if (typeof this.aiValidationService.validate === 'function') {
        validationOutcome = await this.aiValidationService.validate({
          scan: sanitizeScan(scan),
          images: storedImages,
          scanData: job.scanData,
          metadata: job.metadata || {},
        });
      } else {
        throw createHttpError(500, 'AI validation service is not compatible', 'AI_SERVICE_UNAVAILABLE');
      }
    }

    const validationStatus = validationOutcome?.status || validationOutcome?.validationStatus || 'VALIDATED';
    const validationScore = validationOutcome?.score ?? validationOutcome?.validationScore ?? null;
    const validationResult = validationOutcome?.result ?? validationOutcome ?? null;
    const aiProvider = validationOutcome?.provider ?? validationOutcome?.aiProvider ?? null;

    const updatedScan = await this.scanRepository.updateValidationResult(scanId, {
      status: validationStatus === 'FAILED' ? 'FAILED' : 'VALIDATED',
      validationStatus,
      validationScore,
      validationResult,
      aiProvider,
      aiValidatedAt: new Date(),
    });

    if (this.auditLogService) {
      await this.auditLogService.logEvent('SCAN_VALIDATED', {
        userId: job.createdByUserId || null,
        orgId: scan.orgId,
        resourceType: 'SCAN',
        resourceId: scanId,
        details: {
          validationStatus,
          validationScore,
          aiProvider,
        },
      });
    }

    return {
      scan: sanitizeScan(updatedScan),
      validation: {
        status: validationStatus,
        score: validationScore,
        result: validationResult,
        provider: aiProvider,
      },
      images: storedImages,
    };
  }
}

module.exports = {
  ScanService,
  createHttpError,
};