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

function normalizeSeverity(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(normalized)) {
    return normalized;
  }

  return 'HIGH';
}

function buildAuditPayload(context, alert, reverseShipment) {
  return {
    alertId: alert?.id ?? null,
    alertKey: alert?.alertKey ?? context.decisionKey,
    reverseShipmentId: reverseShipment?.id ?? null,
    reverseShipmentKey: reverseShipment?.reverseShipmentKey ?? null,
    orderId: context.orderId,
    shipmentId: context.shipmentId ?? null,
    decisionKey: context.decisionKey,
    failureReason: context.failureReason,
    responsibility: context.responsibility,
    metadata: context.metadata,
  };
}

function sanitizeAlert(alert) {
  if (!alert) {
    return null;
  }

  return {
    id: alert.id,
    alertKey: alert.alertKey,
    decisionKey: alert.decisionKey,
    orderId: alert.orderId,
    shipmentId: alert.shipmentId,
    orgId: alert.orgId,
    severity: alert.severity,
    status: alert.status,
    reason: alert.reason,
    responsibilityStatus: alert.responsibilityStatus,
    ownerUserId: alert.ownerUserId,
    ownerRole: alert.ownerRole,
    ownerTeam: alert.ownerTeam,
    metadata: alert.metadata,
    createdByUserId: alert.createdByUserId,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
  };
}

function sanitizeReverseShipment(reverseShipment) {
  if (!reverseShipment) {
    return null;
  }

  return {
    id: reverseShipment.id,
    reverseShipmentKey: reverseShipment.reverseShipmentKey,
    alertId: reverseShipment.alertId,
    decisionKey: reverseShipment.decisionKey,
    orderId: reverseShipment.orderId,
    shipmentId: reverseShipment.shipmentId,
    orgId: reverseShipment.orgId,
    status: reverseShipment.status,
    assignedToUserId: reverseShipment.assignedToUserId,
    assignedRole: reverseShipment.assignedRole,
    carrier: reverseShipment.carrier,
    trackingNumber: reverseShipment.trackingNumber,
    metadata: reverseShipment.metadata,
    createdByUserId: reverseShipment.createdByUserId,
    createdAt: reverseShipment.createdAt,
    updatedAt: reverseShipment.updatedAt,
  };
}

function maybeCall(target, methodNames, args = []) {
  if (!target) {
    return null;
  }

  for (const methodName of methodNames) {
    if (typeof target[methodName] === 'function') {
      return target[methodName](...args);
    }
  }

  return null;
}

class ReverseLogisticsService {
  constructor({
    database = null,
    transactionRunner = null,
    reverseLogisticsRepository,
    shipmentRepository = null,
    auditLogService = null,
    logger = console,
    responsibilityResolver = null,
  } = {}) {
    if (!reverseLogisticsRepository) {
      throw new Error('ReverseLogisticsService requires a reverseLogisticsRepository');
    }

    this.database = database;
    this.transactionRunner = transactionRunner;
    this.reverseLogisticsRepository = reverseLogisticsRepository;
    this.shipmentRepository = shipmentRepository;
    this.auditLogService = auditLogService;
    this.logger = logger;
    this.responsibilityResolver = responsibilityResolver;
  }

  async withTransaction(handler) {
    if (this.transactionRunner && typeof this.transactionRunner.withTransaction === 'function') {
      return this.transactionRunner.withTransaction(handler);
    }

    if (this.database && typeof this.database.connect === 'function') {
      const client = await this.database.connect();
      try {
        await client.query('BEGIN');
        const result = await handler(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          if (this.logger && typeof this.logger.error === 'function') {
            this.logger.error('[ReverseLogistics] Rollback failed', {
              message: rollbackError.message,
            });
          }
        }
        throw error;
      } finally {
        client.release();
      }
    }

    throw new Error('ReverseLogisticsService requires a transactionRunner or a database with connect()');
  }

  async acquireLock(tx, lockKey) {
    if (tx && typeof tx.query === 'function' && lockKey) {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
    }
  }

  normalizeInput(input) {
    if (!isPlainObject(input)) {
      throw createHttpError(400, 'Reverse logistics input must be an object', 'INVALID_INPUT');
    }

    const orderId = normalizeString(input.orderId);
    const decisionKey = normalizeString(input.decisionKey || input.idempotencyKey || input.alertKey || input.scanId);
    const orgId = normalizeString(input.orgId);
    const shipmentId = normalizeString(input.shipmentId) || null;
    const scanId = normalizeString(input.scanId) || null;
    const productId = normalizeString(input.productId) || null;
    const parcelId = normalizeString(input.parcelId) || null;
    const failureReason = normalizeString(input.failureReason || input.reason || 'VALIDATION_FAILED');
    const metadata = isPlainObject(input.metadata) ? input.metadata : {};
    const responsibility = isPlainObject(input.responsibility) ? input.responsibility : {};
    const createdByUserId = normalizeString(input.createdByUserId) || null;

    if (!orderId) {
      throw createHttpError(400, 'orderId is required', 'ORDER_ID_REQUIRED');
    }

    if (!decisionKey) {
      throw createHttpError(400, 'decisionKey is required', 'DECISION_KEY_REQUIRED');
    }

    if (!orgId) {
      throw createHttpError(400, 'orgId is required', 'ORG_ID_REQUIRED');
    }

    return {
      orderId,
      decisionKey,
      orgId,
      shipmentId,
      scanId,
      productId,
      parcelId,
      failureReason,
      metadata,
      responsibility,
      createdByUserId,
    };
  }

  resolveResponsibility(context, alert) {
    if (typeof this.responsibilityResolver === 'function') {
      const resolved = this.responsibilityResolver(context, alert);
      if (resolved && typeof resolved === 'object') {
        return resolved;
      }
    }

    const ownerUserId = normalizeString(context.responsibility.ownerUserId) || null;
    const ownerRole = normalizeString(context.responsibility.ownerRole || 'LOGISTICS').toUpperCase() || 'LOGISTICS';
    const ownerTeam = normalizeString(context.responsibility.ownerTeam || 'REVERSE_LOGISTICS') || 'REVERSE_LOGISTICS';

    return {
      ownerUserId,
      ownerRole,
      ownerTeam,
      responsibilityStatus: ownerUserId ? 'ASSIGNED' : 'QUEUED',
    };
  }

  buildAlertKey(context) {
    return `ALERT-${context.decisionKey}`;
  }

  buildReverseShipmentKey(context) {
    return `RETURN-${context.decisionKey}`;
  }

  async logAudit(eventType, payload) {
    if (!this.auditLogService || typeof this.auditLogService.logAuthEvent !== 'function') {
      return null;
    }

    return this.auditLogService.logAuthEvent({
      eventType,
      userId: payload.userId ?? null,
      orgId: payload.orgId ?? null,
      reason: payload.reason ?? null,
      success: payload.success ?? true,
      email: payload.email ?? null,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
    });
  }

  async triggerReverseLogistics(input) {
    const context = this.normalizeInput(input);
    const lockKey = `${context.orderId}:${context.decisionKey}`;

    return this.withTransaction(async (tx) => {
      await this.acquireLock(tx, lockKey);

      const existingAlert = await this.reverseLogisticsRepository.findAlertByDecisionKey(context.decisionKey, context.orgId);
      const existingReverseShipment = await this.reverseLogisticsRepository.findReverseShipmentByDecisionKey(context.decisionKey, context.orgId);

      if (existingAlert && existingReverseShipment) {
        return {
          alert: sanitizeAlert(existingAlert),
          responsibility: {
            ownerUserId: existingAlert.ownerUserId,
            ownerRole: existingAlert.ownerRole,
            ownerTeam: existingAlert.ownerTeam,
            responsibilityStatus: existingAlert.responsibilityStatus,
          },
          reverseShipment: sanitizeReverseShipment(existingReverseShipment),
          auditTrail: { reused: true },
        };
      }

      const alertKey = this.buildAlertKey(context);
      const alert = existingAlert || await this.reverseLogisticsRepository.createAlert({
        alertKey,
        decisionKey: context.decisionKey,
        orderId: context.orderId,
        shipmentId: context.shipmentId,
        orgId: context.orgId,
        severity: normalizeSeverity(context.responsibility.severity || context.metadata.severity),
        status: 'OPEN',
        reason: context.failureReason,
        responsibilityStatus: 'UNASSIGNED',
        metadata: {
          ...context.metadata,
          scanId: context.scanId,
          productId: context.productId,
          parcelId: context.parcelId,
        },
        createdByUserId: context.createdByUserId,
      });

      if (!existingAlert) {
        await this.logAudit('REVERSE_LOGISTICS_ALERT_CREATED', {
          userId: context.createdByUserId,
          orgId: context.orgId,
          reason: context.failureReason,
          success: true,
        });
      }

      const responsibility = this.resolveResponsibility(context, alert);
      const updatedAlert = await this.reverseLogisticsRepository.updateAlert(alert.id, {
        status: 'OPEN',
        severity: normalizeSeverity(context.responsibility.severity || context.metadata.severity),
        reason: context.failureReason,
        responsibilityStatus: responsibility.responsibilityStatus,
        ownerUserId: responsibility.ownerUserId,
        ownerRole: responsibility.ownerRole,
        ownerTeam: responsibility.ownerTeam,
        metadata: {
          ...context.metadata,
          scanId: context.scanId,
          productId: context.productId,
          parcelId: context.parcelId,
          assignedAt: new Date().toISOString(),
        },
      }, tx);

      await this.logAudit('REVERSE_LOGISTICS_RESPONSIBILITY_ASSIGNED', {
        userId: responsibility.ownerUserId || context.createdByUserId,
        orgId: context.orgId,
        reason: context.failureReason,
        success: true,
      });

      const reverseShipmentKey = this.buildReverseShipmentKey(context);
      const reverseShipment = existingReverseShipment || await this.reverseLogisticsRepository.createReverseShipment({
        reverseShipmentKey,
        alertId: updatedAlert.id,
        decisionKey: context.decisionKey,
        orderId: context.orderId,
        shipmentId: context.shipmentId,
        orgId: context.orgId,
        status: 'REQUESTED',
        assignedToUserId: responsibility.ownerUserId,
        assignedRole: responsibility.ownerRole,
        carrier: normalizeString(context.responsibility.carrier) || null,
        trackingNumber: normalizeString(context.responsibility.trackingNumber) || null,
        metadata: {
          ...context.metadata,
          reason: context.failureReason,
          alertId: updatedAlert.id,
        },
        createdByUserId: context.createdByUserId,
      });

      if (!existingReverseShipment) {
        await this.logAudit('REVERSE_SHIPMENT_STARTED', {
          userId: responsibility.ownerUserId || context.createdByUserId,
          orgId: context.orgId,
          reason: context.failureReason,
          success: true,
        });
      }

      if (this.shipmentRepository && typeof this.shipmentRepository.recordReverseShipmentRequest === 'function') {
        await this.shipmentRepository.recordReverseShipmentRequest(context.shipmentId || context.orderId, {
          reverseShipmentId: reverseShipment.id,
          alertId: updatedAlert.id,
          assignedToUserId: responsibility.ownerUserId,
          assignedRole: responsibility.ownerRole,
          status: 'REVERSAL_REQUESTED',
        }, tx);
      }

      await this.logAudit('REVERSE_LOGISTICS_TRIGGERED', {
        userId: context.createdByUserId,
        orgId: context.orgId,
        reason: context.failureReason,
        success: true,
      });

      return {
        alert: sanitizeAlert(updatedAlert),
        responsibility,
        reverseShipment: sanitizeReverseShipment(reverseShipment),
        auditTrail: {
          eventType: 'REVERSE_LOGISTICS_TRIGGERED',
          orderId: context.orderId,
          decisionKey: context.decisionKey,
          alertId: updatedAlert.id,
          reverseShipmentId: reverseShipment.id,
          failureReason: context.failureReason,
          responsibilityEvent: 'REVERSE_LOGISTICS_RESPONSIBILITY_ASSIGNED',
          alertEvent: 'REVERSE_LOGISTICS_ALERT_CREATED',
          shipmentEvent: 'REVERSE_SHIPMENT_STARTED',
        },
      };
    });
  }

  async enqueueReverseLogistics(input) {
    return this.triggerReverseLogistics(input);
  }

  async initiateReverseLogistics(input) {
    return this.triggerReverseLogistics(input);
  }

  async createReturnOrder(input) {
    return this.triggerReverseLogistics(input);
  }
}

module.exports = {
  ReverseLogisticsService,
  createHttpError,
};