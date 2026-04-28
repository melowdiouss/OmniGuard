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

function normalizeTimeline(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }

  return Math.min(parsed, 250);
}

function sanitizeOrder(order) {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    orgId: order.orgId,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    orderData: order.orderData,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function sanitizeShipment(shipment) {
  if (!shipment) {
    return null;
  }

  return {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    orderId: shipment.orderId,
    orgId: shipment.orgId,
    assignedLogisticsUserId: shipment.assignedLogisticsUserId,
    status: shipment.status,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    eta: shipment.eta,
    lastScanAt: shipment.lastScanAt,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

function sanitizeTimelineEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    orderId: entry.orderId,
    shipmentId: entry.shipmentId,
    scanId: entry.scanId,
    eventType: entry.eventType,
    status: entry.status,
    location: entry.location,
    description: entry.description,
    metadata: entry.metadata,
    createdAt: entry.createdAt,
  };
}

class OrderTrackingService {
  constructor({ orderRepository, shipmentRepository, scanRepository, auditLogService } = {}) {
    if (!orderRepository) {
      throw new Error('OrderTrackingService requires an orderRepository');
    }

    if (!shipmentRepository) {
      throw new Error('OrderTrackingService requires a shipmentRepository');
    }

    this.orderRepository = orderRepository;
    this.shipmentRepository = shipmentRepository;
    this.scanRepository = scanRepository;
    this.auditLogService = auditLogService;
  }

  normalizeContext(context) {
    if (!isPlainObject(context)) {
      throw createHttpError(400, 'Context must be an object', 'INVALID_CONTEXT');
    }

    const orgId = normalizeString(context.orgId);
    const userId = normalizeString(context.userId);
    const role = normalizeString(context.role).toUpperCase();

    if (!orgId) {
      throw createHttpError(400, 'orgId is required', 'ORG_ID_REQUIRED');
    }

    if (!userId) {
      throw createHttpError(400, 'userId is required', 'USER_ID_REQUIRED');
    }

    if (!role) {
      throw createHttpError(400, 'role is required', 'ROLE_REQUIRED');
    }

    return { orgId, userId, role };
  }

  async getOrderForCustomer(orderId, context) {
    const { orgId, userId, role } = this.normalizeContext(context);

    if (role !== 'CUSTOMER' && role !== 'ADMIN') {
      throw createHttpError(403, 'Forbidden', 'FORBIDDEN');
    }

    const order = await this.orderRepository.findByIdForCustomer(orderId, userId, orgId);
    if (!order) {
      throw createHttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
    }

    return sanitizeOrder(order);
  }

  async getTrackingTimeline(orderId, context, limit = 100) {
    const { orgId, userId, role } = this.normalizeContext(context);

    if (role !== 'CUSTOMER' && role !== 'LOGISTICS' && role !== 'ADMIN') {
      throw createHttpError(403, 'Forbidden', 'FORBIDDEN');
    }

    const order =
      role === 'CUSTOMER'
        ? await this.orderRepository.findByIdForCustomer(orderId, userId, orgId)
        : await this.orderRepository.findByIdForLogistics(orderId, orgId);

    if (!order) {
      throw createHttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
    }

    const entries = await this.orderRepository.findTrackingTimeline(orderId, orgId, normalizeTimeline(limit));

    return {
      order: sanitizeOrder(order),
      timeline: entries.map(sanitizeTimelineEntry),
    };
  }

  async getAssignedShipments(context, options = {}) {
    const { orgId, userId, role } = this.normalizeContext(context);

    if (role !== 'LOGISTICS' && role !== 'ADMIN') {
      throw createHttpError(403, 'Forbidden', 'FORBIDDEN');
    }

    const limit = normalizeTimeline(options.limit ?? 50);
    const offset = Number.isFinite(Number(options.offset)) ? Math.max(0, Number(options.offset)) : 0;

    const shipments = await this.shipmentRepository.findAssignedShipments(userId, orgId, limit, offset);

    return {
      shipments: shipments.map(sanitizeShipment),
      page: {
        limit,
        offset,
      },
    };
  }

  async scanPackage(shipmentId, input, context) {
    const { orgId, userId, role } = this.normalizeContext(context);

    if (role !== 'LOGISTICS' && role !== 'ADMIN') {
      throw createHttpError(403, 'Forbidden', 'FORBIDDEN');
    }

    const shipment = await this.shipmentRepository.findByIdForLogistics(shipmentId, orgId);
    if (!shipment) {
      throw createHttpError(404, 'Shipment not found', 'SHIPMENT_NOT_FOUND');
    }

    if (shipment.assignedLogisticsUserId && shipment.assignedLogisticsUserId !== userId && role !== 'ADMIN') {
      throw createHttpError(403, 'Shipment is not assigned to this user', 'SHIPMENT_NOT_ASSIGNED');
    }

    const scanData = input?.scanData;
    if (!scanData) {
      throw createHttpError(400, 'scanData is required', 'SCAN_DATA_REQUIRED');
    }

    const scanRecord = this.scanRepository && typeof this.scanRepository.create === 'function'
      ? await this.scanRepository.create({
          productId: input.productId || shipment.orderId,
          parcelId: input.parcelId || shipment.id,
          orgId,
          scanType: input.scanType || 'LOGISTICS_PACKAGE_SCAN',
          scanData,
          images: input.images || [],
          status: 'QUEUED',
          validationStatus: 'PENDING',
          createdByUserId: userId,
        })
      : null;

    const updatedShipment = await this.shipmentRepository.recordPackageScan(shipmentId, {
      status: 'SCANNED',
    });

    if (this.auditLogService) {
      await this.auditLogService.logEvent('PACKAGE_SCANNED', {
        userId,
        orgId,
        resourceType: 'SHIPMENT',
        resourceId: shipmentId,
        details: {
          scanId: scanRecord?.id ?? null,
        },
      });
    }

    return {
      shipment: sanitizeShipment(updatedShipment),
      scan: scanRecord
        ? {
            id: scanRecord.id,
            productId: scanRecord.productId,
            parcelId: scanRecord.parcelId,
            orgId: scanRecord.orgId,
            status: scanRecord.status,
            validationStatus: scanRecord.validationStatus,
            createdAt: scanRecord.createdAt,
          }
        : null,
    };
  }
}

module.exports = {
  OrderTrackingService,
  createHttpError,
};