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

function normalizeDecisionValue(value) {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized) {
    return 'REVIEW';
  }

  if (['PASS', 'PASSED', 'APPROVED', 'VALID', 'VALIDATED', 'SUCCESS'].includes(normalized)) {
    return 'PASS';
  }

  if (['FAIL', 'FAILED', 'REJECT', 'REJECTED', 'INVALID', 'ERROR'].includes(normalized)) {
    return 'FAIL';
  }

  return 'REVIEW';
}

function deriveDecisionFromValidation(validationResult) {
  if (!validationResult) {
    return 'REVIEW';
  }

  if (typeof validationResult === 'string') {
    return normalizeDecisionValue(validationResult);
  }

  if (typeof validationResult.finalDecision === 'string') {
    return normalizeDecisionValue(validationResult.finalDecision);
  }

  if (typeof validationResult.decision === 'string') {
    return normalizeDecisionValue(validationResult.decision);
  }

  if (typeof validationResult.allValidationsPass === 'boolean') {
    return validationResult.allValidationsPass ? 'PASS' : 'FAIL';
  }

  if (Array.isArray(validationResult.providers)) {
    if (validationResult.providers.length > 0) {
      const allPassed = validationResult.providers.every((provider) => {
        if (!provider) {
          return false;
        }

        if (typeof provider.passed === 'boolean') {
          return provider.passed;
        }

        return normalizeDecisionValue(provider.status) === 'PASS';
      });

      return allPassed ? 'PASS' : 'FAIL';
    }
  }

  return 'REVIEW';
}

function sanitizeDecisionRecord(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    decisionKey: record.decisionKey ?? record.idempotencyKey ?? null,
    orderId: record.orderId,
    scanId: record.scanId ?? null,
    productId: record.productId ?? null,
    parcelId: record.parcelId ?? null,
    decision: record.decision ?? record.finalDecision ?? null,
    status: record.status ?? null,
    reason: record.reason ?? null,
    blockchainTransactionId: record.blockchainTransactionId ?? null,
    blockchainGenesisHash: record.blockchainGenesisHash ?? null,
    reverseLogisticsId: record.reverseLogisticsId ?? null,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
  };
}

function callFirstAvailableMethod(target, methodNames, args = []) {
  if (!target) {
    return null;
  }

  for (const methodName of methodNames) {
    if (typeof target[methodName] === 'function') {
      return {
        called: true,
        result: target[methodName](...args),
      };
    }
  }

  return null;
}

async function maybeCallFirstAvailableMethod(target, methodNames, args = []) {
  const invocation = callFirstAvailableMethod(target, methodNames, args);
  if (!invocation) {
    return null;
  }

  return invocation.result;
}

class DecisionEngineService {
  constructor({
    database = null,
    transactionRunner = null,
    decisionStore = null,
    orderStore = null,
    blockchainService = null,
    reverseLogisticsService = null,
    logger = console,
  } = {}) {
    this.database = database;
    this.transactionRunner = transactionRunner;
    this.decisionStore = decisionStore;
    this.orderStore = orderStore;
    this.blockchainService = blockchainService;
    this.reverseLogisticsService = reverseLogisticsService;
    this.logger = logger;
  }

  assertConfigured() {
    if (!this.decisionStore) {
      throw new Error('DecisionEngineService requires a decisionStore');
    }

    if (!this.orderStore) {
      throw new Error('DecisionEngineService requires an orderStore');
    }

    if (!this.blockchainService) {
      throw new Error('DecisionEngineService requires a blockchainService');
    }

    if (!this.reverseLogisticsService) {
      throw new Error('DecisionEngineService requires a reverseLogisticsService');
    }
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
            this.logger.error('[DecisionEngine] Rollback failed', {
              message: rollbackError.message,
            });
          }
        }
        throw error;
      } finally {
        client.release();
      }
    }

    throw new Error('DecisionEngineService requires a transactionRunner or a database with connect()');
  }

  async acquireLock(tx, lockKey) {
    if (!lockKey) {
      return;
    }

    if (tx && typeof tx.query === 'function') {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
    }
  }

  async loadDecisionByKey(tx, decisionKey) {
    if (!this.decisionStore) {
      return null;
    }

    return maybeCallFirstAvailableMethod(this.decisionStore, ['findByIdempotencyKey', 'findByKey', 'getByKey'], [decisionKey, tx]);
  }

  async createDecision(tx, payload) {
    return maybeCallFirstAvailableMethod(this.decisionStore, ['create', 'insert', 'createDecision'], [payload, tx]);
  }

  async updateDecision(tx, decisionId, patch) {
    return maybeCallFirstAvailableMethod(this.decisionStore, ['updateById', 'update', 'patch'], [decisionId, patch, tx]);
  }

  async lockOrder(tx, orderId) {
    return maybeCallFirstAvailableMethod(this.orderStore, ['findByIdForUpdate', 'findForUpdate', 'lockById'], [orderId, tx]);
  }

  async cancelOrder(tx, orderId, payload) {
    return maybeCallFirstAvailableMethod(this.orderStore, ['cancelOrder', 'updateStatus', 'markCancelled'], [orderId, payload, tx]);
  }

  async markOrderValidated(tx, orderId, payload) {
    return maybeCallFirstAvailableMethod(this.orderStore, ['markValidated', 'updateStatus', 'markCompleted'], [orderId, payload, tx]);
  }

  async updateBlockchain(tx, payload) {
    const appendInvocation = callFirstAvailableMethod(this.blockchainService, [
      'appendTransaction',
      'submitTransaction',
      'recordTransaction',
    ], [payload, { transaction: tx }]);

    if (appendInvocation) {
      return appendInvocation.result;
    }

    const genesisInvocation = callFirstAvailableMethod(this.blockchainService, [
      'createGenesisBlock',
      'linkGenesis',
      'recordGenesis',
    ], [payload, { transaction: tx }]);

    if (genesisInvocation) {
      return genesisInvocation.result;
    }

    throw createHttpError(500, 'Blockchain service does not expose an update method', 'BLOCKCHAIN_METHOD_MISSING');
  }

  async triggerReverseLogistics(tx, payload) {
    const invocation = callFirstAvailableMethod(this.reverseLogisticsService, [
      'triggerReverseLogistics',
      'enqueueReverseLogistics',
      'createReverseLogistics',
      'initiateReverseLogistics',
      'createReturnOrder',
    ], [payload, { transaction: tx }]);

    if (invocation) {
      return invocation.result;
    }

    throw createHttpError(500, 'Reverse logistics service does not expose a trigger method', 'REVERSE_LOGISTICS_METHOD_MISSING');
  }

  buildLockKey({ decisionKey, orderId }) {
    return normalizeString(decisionKey) || `order:${normalizeString(orderId)}`;
  }

  normalizeInput(input) {
    if (!isPlainObject(input)) {
      throw createHttpError(400, 'Decision input must be an object', 'INVALID_INPUT');
    }

    const orderId = normalizeString(input.orderId);
    const decisionKey = normalizeString(input.decisionKey || input.idempotencyKey || input.scanId || input.productId);
    const scanId = normalizeString(input.scanId) || null;
    const productId = normalizeString(input.productId) || null;
    const parcelId = normalizeString(input.parcelId) || null;
    const orderReference = normalizeString(input.orderReference) || null;
    const validationResult = input.validationResult ?? input.validationSummary ?? null;
    const metadata = isPlainObject(input.metadata) ? input.metadata : {};

    if (!orderId) {
      throw createHttpError(400, 'orderId is required', 'ORDER_ID_REQUIRED');
    }

    if (!decisionKey) {
      throw createHttpError(400, 'decisionKey is required', 'DECISION_KEY_REQUIRED');
    }

    if (!validationResult) {
      throw createHttpError(400, 'validationResult is required', 'VALIDATION_RESULT_REQUIRED');
    }

    return {
      orderId,
      decisionKey,
      scanId,
      productId,
      parcelId,
      orderReference,
      validationResult,
      metadata,
    };
  }

  buildBlockchainPayload(context, decision) {
    return {
      type: 'DECISION_ENGINE_UPDATE',
      decision,
      orderId: context.orderId,
      decisionKey: context.decisionKey,
      scanId: context.scanId,
      productId: context.productId,
      parcelId: context.parcelId,
      orderReference: context.orderReference,
      validationResult: context.validationResult,
      metadata: context.metadata,
      createdAt: new Date().toISOString(),
    };
  }

  buildReverseLogisticsPayload(context, decision) {
    return {
      type: 'ORDER_REVERSED',
      orderId: context.orderId,
      decisionKey: context.decisionKey,
      scanId: context.scanId,
      productId: context.productId,
      parcelId: context.parcelId,
      orderReference: context.orderReference,
      validationResult: context.validationResult,
      decision,
      metadata: context.metadata,
      createdAt: new Date().toISOString(),
    };
  }

  async processDecision(input) {
    this.assertConfigured();
    const context = this.normalizeInput(input);
    const finalDecision = deriveDecisionFromValidation(context.validationResult);
    const lockKey = this.buildLockKey(context);

    return this.withTransaction(async (tx) => {
      await this.acquireLock(tx, lockKey);

      const existingDecision = await this.loadDecisionByKey(tx, context.decisionKey);
      if (existingDecision && normalizeString(existingDecision.status).toUpperCase() === 'COMPLETED') {
        return sanitizeDecisionRecord(existingDecision);
      }

      const order = await this.lockOrder(tx, context.orderId);
      if (!order) {
        throw createHttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
      }

      if (['CANCELLED', 'COMPLETED', 'CLOSED'].includes(normalizeString(order.status).toUpperCase())) {
        throw createHttpError(409, 'Order is already closed', 'ORDER_ALREADY_CLOSED');
      }

      const decisionRecord = existingDecision || await this.createDecision(tx, {
        decisionKey: context.decisionKey,
        orderId: context.orderId,
        scanId: context.scanId,
        productId: context.productId,
        parcelId: context.parcelId,
        status: 'PROCESSING',
        decision: finalDecision,
        validationResult: context.validationResult,
        metadata: context.metadata,
        orderReference: context.orderReference,
      });

      const sanitizedExisting = sanitizeDecisionRecord(decisionRecord) || {
        id: null,
        decisionKey: context.decisionKey,
        orderId: context.orderId,
        scanId: context.scanId,
        productId: context.productId,
        parcelId: context.parcelId,
        status: 'PROCESSING',
      };

      let blockchainResult = null;
      let reverseLogisticsResult = null;
      let updatedOrder = null;

      if (finalDecision === 'PASS') {
        blockchainResult = await this.updateBlockchain(tx, this.buildBlockchainPayload(context, finalDecision));

        updatedOrder = await this.markOrderValidated(tx, context.orderId, {
          decisionKey: context.decisionKey,
          blockchainResult,
          validationResult: context.validationResult,
          metadata: context.metadata,
        });

        const completedDecision = await this.updateDecision(tx, sanitizedExisting.id || sanitizedExisting.decisionKey || context.decisionKey, {
          status: 'COMPLETED',
          decision: 'PASS',
          blockchainTransactionId:
            blockchainResult?.transactionId || blockchainResult?.txId || blockchainResult?.id || null,
          blockchainGenesisHash:
            blockchainResult?.genesisHash || blockchainResult?.hash || blockchainResult?.blockHash || null,
          reverseLogisticsId: null,
          completedAt: new Date(),
        });

        return {
          decision: 'PASS',
          order: updatedOrder || order,
          blockchain: blockchainResult,
          reverseLogistics: null,
          decisionRecord: sanitizeDecisionRecord(completedDecision || sanitizedExisting),
        };
      }

      updatedOrder = await this.cancelOrder(tx, context.orderId, {
        decisionKey: context.decisionKey,
        reason: 'VALIDATION_FAILED',
        validationResult: context.validationResult,
        metadata: context.metadata,
      });

      reverseLogisticsResult = await this.triggerReverseLogistics(tx, this.buildReverseLogisticsPayload(context, finalDecision));

        const completedDecision = await this.updateDecision(tx, sanitizedExisting.id || sanitizedExisting.decisionKey || context.decisionKey, {
        status: 'COMPLETED',
        decision: 'FAIL',
        blockchainTransactionId: null,
        reverseLogisticsId:
          reverseLogisticsResult?.id || reverseLogisticsResult?.reverseLogisticsId || reverseLogisticsResult?.jobId || null,
        completedAt: new Date(),
      });

      return {
        decision: 'FAIL',
        order: updatedOrder || order,
        blockchain: null,
        reverseLogistics: reverseLogisticsResult,
        decisionRecord: sanitizeDecisionRecord(completedDecision || sanitizedExisting),
      };
    });
  }

  async evaluate(validationResult, context = {}) {
    return this.processDecision({
      ...context,
      validationResult,
    });
  }
}

module.exports = {
  DecisionEngineService,
  createHttpError,
};