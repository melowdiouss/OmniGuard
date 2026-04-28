const crypto = require('crypto');

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function validateRequiredString(value, fieldName) {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw createHttpError(400, `${fieldName} is required`, `${fieldName.toUpperCase()}_REQUIRED`);
  }
  return normalized;
}

function validateOptionalString(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createHttpError(400, `${fieldName} must be a string`, `${fieldName.toUpperCase()}_INVALID`);
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeImagePayload(value, fieldName) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      throw createHttpError(400, `${fieldName} is required`, `${fieldName.toUpperCase()}_REQUIRED`);
    }
    return { value: normalized, type: 'string' };
  }

  if (isPlainObject(value)) {
    const payload = { ...value };
    if (!Object.keys(payload).length) {
      throw createHttpError(400, `${fieldName} is required`, `${fieldName.toUpperCase()}_REQUIRED`);
    }
    return { value: payload, type: 'object' };
  }

  throw createHttpError(400, `${fieldName} must be a string or object`, `${fieldName.toUpperCase()}_INVALID`);
}

function buildDualQrPayloads({ productId, parcelId, sku, parcelCode, genesisId, orgId }) {
  const issuedAt = new Date().toISOString();

  const productQrPayload = {
    type: 'PRODUCT',
    productId,
    sku,
    parcelId,
    genesisId,
    orgId,
    issuedAt,
    version: 1,
  };

  const parcelQrPayload = {
    type: 'PARCEL',
    productId,
    parcelId,
    parcelCode,
    genesisId,
    orgId,
    issuedAt,
    version: 1,
  };

  return {
    productQrPayload,
    parcelQrPayload,
    productQrData: JSON.stringify(productQrPayload),
    parcelQrData: JSON.stringify(parcelQrPayload),
  };
}

function sanitizeProductRecord(product) {
  if (!product) {
    return null;
  }

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description ?? null,
    orgId: product.orgId,
    brandId: product.brandId ?? null,
    status: product.status ?? null,
    pufImage: product.pufImage ?? null,
    parcelImage: product.parcelImage ?? null,
    blockchainGenesisHash: product.blockchainGenesisHash ?? null,
    blockchainGenesisTxId: product.blockchainGenesisTxId ?? null,
    productQrData: product.productQrData ?? null,
    parcelQrData: product.parcelQrData ?? null,
    createdAt: product.createdAt ?? null,
    updatedAt: product.updatedAt ?? null,
  };
}

function sanitizeParcelRecord(parcel) {
  if (!parcel) {
    return null;
  }

  return {
    id: parcel.id,
    productId: parcel.productId,
    parcelCode: parcel.parcelCode,
    trackingNumber: parcel.trackingNumber ?? null,
    status: parcel.status ?? null,
    pufImage: parcel.pufImage ?? null,
    parcelImage: parcel.parcelImage ?? null,
    blockchainGenesisHash: parcel.blockchainGenesisHash ?? null,
    blockchainGenesisTxId: parcel.blockchainGenesisTxId ?? null,
    createdAt: parcel.createdAt ?? null,
    updatedAt: parcel.updatedAt ?? null,
  };
}

function buildGenesisInput({ product, parcel, qrPayloads, actor, metadata }) {
  return {
    product: sanitizeProductRecord(product),
    parcel: sanitizeParcelRecord(parcel),
    qrPayloads,
    actor: actor
      ? {
          userId: actor.userId ?? null,
          orgId: actor.orgId ?? null,
          role: actor.role ?? null,
        }
      : null,
    metadata: metadata || {},
  };
}

class ProductService {
  constructor({ productRepository, parcelRepository, blockchainService, auditLogService } = {}) {
    if (!productRepository) {
      throw new Error('ProductService requires a productRepository');
    }

    if (!parcelRepository) {
      throw new Error('ProductService requires a parcelRepository');
    }

    this.productRepository = productRepository;
    this.parcelRepository = parcelRepository;
    this.blockchainService = blockchainService;
    this.auditLogService = auditLogService;
  }

  async createProduct(input, metadata = {}) {
    if (!isPlainObject(input)) {
      throw createHttpError(400, 'Request body must be an object', 'INVALID_PAYLOAD');
    }

    const name = validateRequiredString(input.name, 'name');
    const sku = validateRequiredString(input.sku, 'sku');
    const orgId = validateRequiredString(input.orgId, 'orgId');
    const brandId = validateOptionalString(input.brandId, 'brandId');
    const description = validateOptionalString(input.description, 'description');
    const createdByUserId = validateOptionalString(input.createdByUserId, 'createdByUserId');

    const pufImage = normalizeImagePayload(input.pufImage, 'pufImage');
    const parcelImage = normalizeImagePayload(input.parcelImage, 'parcelImage');

    const parcelInput = isPlainObject(input.parcel) ? input.parcel : {};
    const parcelCode = validateOptionalString(parcelInput.parcelCode, 'parcel.parcelCode') || `PARCEL-${crypto.randomUUID()}`;
    const trackingNumber = validateOptionalString(parcelInput.trackingNumber, 'parcel.trackingNumber');
    const parcelStatus = validateOptionalString(parcelInput.status, 'parcel.status') || 'INITIALIZED';

    const existingProduct = await this.productRepository.findBySkuAndOrg(sku, orgId);
    if (existingProduct) {
      throw createHttpError(409, 'Product SKU already exists in this organization', 'SKU_ALREADY_EXISTS');
    }

    const createdProduct = await this.productRepository.create({
      name,
      sku,
      description,
      orgId,
      brandId,
      createdByUserId,
      pufImage: pufImage.value,
      parcelImage: parcelImage.value,
      status: 'INITIALIZING',
    });

    const createdParcel = await this.parcelRepository.create({
      productId: createdProduct.id,
      orgId,
      parcelCode,
      trackingNumber,
      status: parcelStatus,
      pufImage: pufImage.value,
      parcelImage: parcelImage.value,
      createdByUserId,
    });

    const genesisId = crypto.randomUUID();
    const qrPayloads = buildDualQrPayloads({
      productId: createdProduct.id,
      parcelId: createdParcel.id,
      sku,
      parcelCode,
      genesisId,
      orgId,
    });

    const genesisInput = buildGenesisInput({
      product: createdProduct,
      parcel: createdParcel,
      qrPayloads,
      actor: {
        userId: createdByUserId,
        orgId,
        role: metadata.role || null,
      },
      metadata,
    });

    let blockchainGenesis = null;
    if (this.blockchainService) {
      if (typeof this.blockchainService.linkGenesis === 'function') {
        blockchainGenesis = await this.blockchainService.linkGenesis(genesisInput);
      } else if (typeof this.blockchainService.createGenesisBlock === 'function') {
        blockchainGenesis = await this.blockchainService.createGenesisBlock(genesisInput);
      } else if (typeof this.blockchainService.recordGenesis === 'function') {
        blockchainGenesis = await this.blockchainService.recordGenesis(genesisInput);
      } else {
        throw createHttpError(500, 'Blockchain service does not support genesis linking', 'BLOCKCHAIN_UNAVAILABLE');
      }
    }

    const blockchainGenesisHash = blockchainGenesis?.genesisHash || blockchainGenesis?.hash || blockchainGenesis?.blockHash || null;
    const blockchainGenesisTxId = blockchainGenesis?.transactionId || blockchainGenesis?.txId || blockchainGenesis?.genesisTxId || null;

    const updatedProduct = await this.productRepository.updateById(createdProduct.id, {
      status: 'ACTIVE',
      productQrData: qrPayloads.productQrData,
      parcelQrData: qrPayloads.parcelQrData,
      blockchainGenesisHash,
      blockchainGenesisTxId,
    });

    const updatedParcel = await this.parcelRepository.updateById(createdParcel.id, {
      status: 'ACTIVE',
      blockchainGenesisHash,
      blockchainGenesisTxId,
    });

    if (this.auditLogService) {
      await this.auditLogService.logEvent('PRODUCT_CREATED', {
        userId: createdByUserId,
        orgId,
        resourceType: 'PRODUCT',
        resourceId: updatedProduct.id,
        details: {
          sku,
          parcelId: updatedParcel.id,
          genesisId,
        },
      });
    }

    return {
      product: sanitizeProductRecord({
        ...updatedProduct,
        pufImage: pufImage.value,
        parcelImage: parcelImage.value,
        productQrData: qrPayloads.productQrData,
        parcelQrData: qrPayloads.parcelQrData,
        blockchainGenesisHash,
        blockchainGenesisTxId,
      }),
      parcel: sanitizeParcelRecord({
        ...updatedParcel,
        pufImage: pufImage.value,
        parcelImage: parcelImage.value,
        blockchainGenesisHash,
        blockchainGenesisTxId,
      }),
      qrs: {
        product: qrPayloads.productQrPayload,
        parcel: qrPayloads.parcelQrPayload,
      },
      blockchain: blockchainGenesis
        ? {
            genesisHash: blockchainGenesisHash,
            transactionId: blockchainGenesisTxId,
            raw: blockchainGenesis,
          }
        : null,
    };
  }
}

module.exports = {
  ProductService,
  createHttpError,
};
