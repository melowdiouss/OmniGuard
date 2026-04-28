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

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAdapterHandler(service, methodNames) {
  if (!service) {
    return null;
  }

  for (const methodName of methodNames) {
    if (typeof service[methodName] === 'function') {
      return service[methodName].bind(service);
    }
  }

  return null;
}

function normalizeProviderResult(providerName, result) {
  if (!result) {
    return {
      provider: providerName,
      status: 'NO_RESULT',
      score: null,
      confidence: null,
      passed: false,
      details: null,
    };
  }

  if (typeof result === 'string') {
    return {
      provider: providerName,
      status: result,
      score: null,
      confidence: null,
      passed: result.toUpperCase() === 'PASS',
      details: null,
    };
  }

  const status = normalizeString(result.status || result.verdict || result.decision || 'UNKNOWN') || 'UNKNOWN';
  const score = toNumber(result.score ?? result.confidence ?? result.probability, null);
  const passed =
    typeof result.passed === 'boolean'
      ? result.passed
      : ['PASS', 'VALID', 'APPROVED', 'TRUE', 'ACCEPTED'].includes(status.toUpperCase());

  return {
    provider: result.provider || providerName,
    status,
    score,
    confidence: score,
    passed,
    details: result.details ?? result.result ?? result.data ?? result,
    raw: result,
  };
}

function aggregateProviderResults(results, policy = {}) {
  const normalizedPolicy = {
    minConfidence: toNumber(policy.minConfidence, 0.75),
    requireAllPass: policy.requireAllPass !== undefined ? Boolean(policy.requireAllPass) : true,
    allowWarnings: policy.allowWarnings !== undefined ? Boolean(policy.allowWarnings) : true,
    failFastOnCritical: policy.failFastOnCritical !== undefined ? Boolean(policy.failFastOnCritical) : true,
  };

  const providers = results.map((entry) => entry.result);
  const failures = providers.filter((provider) => provider.status === 'ERROR' || provider.status === 'FAILED');
  const confidenceValues = providers
    .map((provider) => provider.confidence)
    .filter((value) => Number.isFinite(value));

  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : null;

  const allPassed = providers.length > 0 && providers.every((provider) => provider.passed === true);
  const anyCriticalFailure = providers.some((provider) => provider.status === 'CRITICAL' || provider.status === 'REJECTED');
  const enoughConfidence = averageConfidence === null ? false : averageConfidence >= normalizedPolicy.minConfidence;

  let finalDecision = 'REVIEW';
  if (failures.length > 0 && normalizedPolicy.failFastOnCritical) {
    finalDecision = 'FAIL';
  } else if (anyCriticalFailure) {
    finalDecision = 'FAIL';
  } else if (allPassed && enoughConfidence) {
    finalDecision = 'PASS';
  } else if (providers.some((provider) => provider.status === 'WARNING') && normalizedPolicy.allowWarnings) {
    finalDecision = 'REVIEW';
  } else if (normalizedPolicy.requireAllPass && allPassed) {
    finalDecision = enoughConfidence ? 'PASS' : 'REVIEW';
  }

  return {
    finalDecision,
    averageConfidence,
    counts: {
      total: providers.length,
      passed: providers.filter((provider) => provider.passed).length,
      failed: failures.length,
      warnings: providers.filter((provider) => provider.status === 'WARNING').length,
    },
    providers,
    policy: normalizedPolicy,
  };
}

class AIValidationOrchestratorService {
  constructor({
    pufService,
    cvService,
    metadataAnomalyService,
    analyzers = [],
    decisionStrategy = null,
    logger = console,
  } = {}) {
    this.pufService = pufService;
    this.cvService = cvService;
    this.metadataAnomalyService = metadataAnomalyService;
    this.logger = logger;
    this.decisionStrategy = typeof decisionStrategy === 'function' ? decisionStrategy : aggregateProviderResults;
    this.analyzers = [];

    this.registerBuiltInAnalyzers();

    for (const analyzer of analyzers) {
      this.registerAnalyzer(analyzer);
    }
  }

  registerAnalyzer(analyzer) {
    if (!analyzer || typeof analyzer !== 'object') {
      throw new Error('Analyzer must be an object');
    }

    const name = normalizeString(analyzer.name);
    const handler = typeof analyzer.handler === 'function' ? analyzer.handler : null;

    if (!name) {
      throw new Error('Analyzer name is required');
    }

    if (!handler) {
      throw new Error(`Analyzer "${name}" requires a handler function`);
    }

    this.analyzers.push({
      name,
      handler,
      weight: toNumber(analyzer.weight, 1),
      critical: analyzer.critical !== undefined ? Boolean(analyzer.critical) : true,
      timeoutMs: toNumber(analyzer.timeoutMs, null),
    });
  }

  registerBuiltInAnalyzers() {
    const pufHandler = getAdapterHandler(this.pufService, ['validate', 'validatePuf', 'analyze', 'runValidation']);
    const cvHandler = getAdapterHandler(this.cvService, ['validate', 'validateImage', 'analyze', 'runValidation']);
    const metadataHandler = getAdapterHandler(this.metadataAnomalyService, [
      'validate',
      'validateMetadata',
      'analyze',
      'runValidation',
    ]);

    if (pufHandler) {
      this.registerAnalyzer({
        name: 'PUF',
        handler: pufHandler,
        weight: 1,
        critical: true,
      });
    }

    if (cvHandler) {
      this.registerAnalyzer({
        name: 'CV',
        handler: cvHandler,
        weight: 1,
        critical: true,
      });
    }

    if (metadataHandler) {
      this.registerAnalyzer({
        name: 'METADATA_ANOMALY',
        handler: metadataHandler,
        weight: 1,
        critical: false,
      });
    }
  }

  async runAnalyzer(analyzer, input) {
    try {
      const rawResult = await analyzer.handler(input);
      const normalized = normalizeProviderResult(analyzer.name, rawResult);

      return {
        name: analyzer.name,
        weight: analyzer.weight,
        critical: analyzer.critical,
        status: 'FULFILLED',
        result: normalized,
      };
    } catch (error) {
      if (this.logger && typeof this.logger.warn === 'function') {
        this.logger.warn(`[AIValidation] ${analyzer.name} analyzer failed`, {
          message: error.message,
          code: error.code,
        });
      }

      return {
        name: analyzer.name,
        weight: analyzer.weight,
        critical: analyzer.critical,
        status: 'REJECTED',
        error: {
          message: error.message,
          code: error.code || 'ANALYZER_FAILED',
        },
        result: normalizeProviderResult(analyzer.name, {
          status: 'ERROR',
          passed: false,
          details: {
            message: error.message,
            code: error.code || 'ANALYZER_FAILED',
          },
        }),
      };
    }
  }

  async validate(input, options = {}) {
    if (!isPlainObject(input)) {
      throw createHttpError(400, 'Validation input must be an object', 'INVALID_INPUT');
    }

    const validationInput = {
      ...input,
      metadata: isPlainObject(input.metadata) ? input.metadata : {},
      context: isPlainObject(input.context) ? input.context : {},
      options: isPlainObject(options) ? options : {},
    };

    const analyzerResults = await Promise.allSettled(
      this.analyzers.map((analyzer) => this.runAnalyzer(analyzer, validationInput)),
    );

    const results = analyzerResults.map((entry, index) => {
      if (entry.status === 'fulfilled') {
        return entry.value;
      }

      const analyzer = this.analyzers[index];
      return {
        name: analyzer?.name || `analyzer_${index + 1}`,
        weight: analyzer?.weight ?? 1,
        critical: analyzer?.critical ?? true,
        status: 'REJECTED',
        error: {
          message: entry.reason?.message || 'Analyzer failed',
          code: entry.reason?.code || 'ANALYZER_FAILED',
        },
        result: normalizeProviderResult(analyzer?.name || `analyzer_${index + 1}`, {
          status: 'ERROR',
          passed: false,
          details: {
            message: entry.reason?.message || 'Analyzer failed',
            code: entry.reason?.code || 'ANALYZER_FAILED',
          },
        }),
      };
    });

    const aggregated = this.decisionStrategy(results, validationInput.policy || options.policy || {});

    return {
      decision: aggregated.finalDecision,
      finalDecision: aggregated.finalDecision,
      confidence: aggregated.averageConfidence,
      counts: aggregated.counts,
      providers: aggregated.providers,
      policy: aggregated.policy,
      meta: {
        analyzerCount: this.analyzers.length,
        executedAt: new Date().toISOString(),
      },
    };
  }

  async validateScan(scanContext, options = {}) {
    if (!isPlainObject(scanContext)) {
      throw createHttpError(400, 'Scan context must be an object', 'INVALID_SCAN_CONTEXT');
    }

    const input = {
      scan: scanContext.scan ?? null,
      product: scanContext.product ?? null,
      parcel: scanContext.parcel ?? null,
      images: Array.isArray(scanContext.images) ? scanContext.images : [],
      scanData: scanContext.scanData ?? null,
      metadata: scanContext.metadata ?? {},
      context: scanContext.context ?? {},
      policy: scanContext.policy ?? options.policy ?? {},
    };

    return this.validate(input, options);
  }

  async validateWithFutureModel(modelName, input, options = {}) {
    if (!normalizeString(modelName)) {
      throw createHttpError(400, 'Model name is required', 'MODEL_NAME_REQUIRED');
    }

    const modelAnalyzer = this.analyzers.find((analyzer) => analyzer.name.toLowerCase() === normalizeString(modelName).toLowerCase());

    if (!modelAnalyzer) {
      throw createHttpError(404, `Analyzer not found: ${modelName}`, 'ANALYZER_NOT_FOUND');
    }

    const result = await this.runAnalyzer(modelAnalyzer, {
      ...(isPlainObject(input) ? input : {}),
      options,
    });

    return {
      provider: result.name,
      result: result.result,
      status: result.result.status,
      confidence: result.result.confidence,
      critical: result.critical,
    };
  }
}

module.exports = {
  AIValidationOrchestratorService,
  createHttpError,
};