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

function normalizeTransactionInput(input) {
  if (!isPlainObject(input)) {
    throw createHttpError(400, 'Transaction input must be an object', 'INVALID_TRANSACTION_INPUT');
  }

  return {
    ...input,
    metadata: isPlainObject(input.metadata) ? input.metadata : {},
  };
}

function normalizeHistoryOptions(options = {}) {
  if (!isPlainObject(options)) {
    return {};
  }

  return {
    limit: Number.isFinite(Number(options.limit)) ? Number(options.limit) : 100,
    cursor: options.cursor ?? null,
    fromTimestamp: options.fromTimestamp ?? null,
    toTimestamp: options.toTimestamp ?? null,
    direction: normalizeString(options.direction || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
  };
}

function normalizeGenesisPayload(payload) {
  if (!isPlainObject(payload)) {
    throw createHttpError(400, 'Genesis payload must be an object', 'INVALID_GENESIS_PAYLOAD');
  }

  return {
    ...payload,
    metadata: isPlainObject(payload.metadata) ? payload.metadata : {},
  };
}

class BlockchainService {
  constructor({ provider = null, logger = console, defaultNetwork = 'default' } = {}) {
    this.provider = provider;
    this.logger = logger;
    this.defaultNetwork = defaultNetwork;
    this.adapters = new Map();
    this.memoryLedgers = new Map();
  }

  setProvider(provider) {
    this.provider = provider;
    return this;
  }

  registerAdapter(networkName, adapter) {
    const normalizedNetwork = normalizeString(networkName);
    if (!normalizedNetwork) {
      throw new Error('Network name is required');
    }

    if (!adapter || typeof adapter !== 'object') {
      throw new Error('Adapter must be an object');
    }

    this.adapters.set(normalizedNetwork, adapter);
    return this;
  }

  resolveAdapter(networkName = null) {
    const normalizedNetwork = normalizeString(networkName) || this.defaultNetwork;

    if (this.adapters.has(normalizedNetwork)) {
      return this.adapters.get(normalizedNetwork);
    }

    return this.provider;
  }

  getAdapterMethods(adapter) {
    if (!adapter) {
      return {};
    }

    return {
      createGenesisBlock: typeof adapter.createGenesisBlock === 'function' ? adapter.createGenesisBlock.bind(adapter) : null,
      appendTransaction: typeof adapter.appendTransaction === 'function' ? adapter.appendTransaction.bind(adapter) : null,
      fetchHistory: typeof adapter.fetchHistory === 'function' ? adapter.fetchHistory.bind(adapter) : null,
      linkGenesis: typeof adapter.linkGenesis === 'function' ? adapter.linkGenesis.bind(adapter) : null,
      recordGenesis: typeof adapter.recordGenesis === 'function' ? adapter.recordGenesis.bind(adapter) : null,
    };
  }

  getLedger(networkName = null) {
    const normalizedNetwork = normalizeString(networkName) || this.defaultNetwork;

    if (!this.memoryLedgers.has(normalizedNetwork)) {
      this.memoryLedgers.set(normalizedNetwork, {
        genesis: null,
        transactions: [],
      });
    }

    return this.memoryLedgers.get(normalizedNetwork);
  }

  buildTransactionRecord(type, payload, context = {}) {
    return {
      id: context.transactionId || context.txId || context.id || null,
      type,
      network: context.network || this.defaultNetwork,
      timestamp: new Date().toISOString(),
      payload,
    };
  }

  async createGenesisBlock(payload, options = {}) {
    const genesisPayload = normalizeGenesisPayload(payload);
    const adapter = this.resolveAdapter(options.network);
    const methods = this.getAdapterMethods(adapter);

    if (methods.createGenesisBlock) {
      return methods.createGenesisBlock(genesisPayload, options);
    }

    if (methods.linkGenesis) {
      return methods.linkGenesis(genesisPayload, options);
    }

    if (methods.recordGenesis) {
      return methods.recordGenesis(genesisPayload, options);
    }

    const ledger = this.getLedger(options.network);
    const genesisHash = `genesis_${ledger.transactions.length + 1}_${Date.now()}`;
    const transactionId = options.transactionId || `tx_${Date.now()}_${ledger.transactions.length + 1}`;

    const record = {
      genesisHash,
      transactionId,
      blockHash: genesisHash,
      payload: genesisPayload,
      network: normalizeString(options.network) || this.defaultNetwork,
      timestamp: new Date().toISOString(),
    };

    ledger.genesis = record;
    ledger.transactions.push(this.buildTransactionRecord('GENESIS', genesisPayload, record));

    return record;
  }

  async linkGenesis(payload, options = {}) {
    return this.createGenesisBlock(payload, options);
  }

  async recordGenesis(payload, options = {}) {
    return this.createGenesisBlock(payload, options);
  }

  async appendTransaction(payload, options = {}) {
    const txPayload = normalizeTransactionInput(payload);
    const adapter = this.resolveAdapter(options.network);
    const methods = this.getAdapterMethods(adapter);

    if (methods.appendTransaction) {
      return methods.appendTransaction(txPayload, options);
    }

    const ledger = this.getLedger(options.network);
    const transactionId = options.transactionId || `tx_${Date.now()}_${ledger.transactions.length + 1}`;
    const record = {
      transactionId,
      txId: transactionId,
      blockHash: options.blockHash || null,
      network: normalizeString(options.network) || this.defaultNetwork,
      timestamp: new Date().toISOString(),
      payload: txPayload,
    };

    ledger.transactions.push(this.buildTransactionRecord('APPEND', txPayload, record));

    return record;
  }

  async fetchHistory(query = {}, options = {}) {
    const normalizedQuery = isPlainObject(query) ? query : {};
    const normalizedOptions = normalizeHistoryOptions(options);
    const adapter = this.resolveAdapter(normalizedQuery.network || normalizedOptions.network);
    const methods = this.getAdapterMethods(adapter);

    if (methods.fetchHistory) {
      return methods.fetchHistory(normalizedQuery, normalizedOptions);
    }

    const ledger = this.getLedger(normalizedQuery.network || normalizedOptions.network);
    const transactions = ledger.transactions.slice();

    const filtered = transactions.filter((entry) => {
      const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : null;

      if (normalizedOptions.fromTimestamp && timestamp && timestamp < new Date(normalizedOptions.fromTimestamp).getTime()) {
        return false;
      }

      if (normalizedOptions.toTimestamp && timestamp && timestamp > new Date(normalizedOptions.toTimestamp).getTime()) {
        return false;
      }

      return true;
    });

    const ordered = normalizedOptions.direction === 'asc' ? filtered : filtered.reverse();
    const limited = ordered.slice(0, normalizedOptions.limit);

    return {
      network: normalizeString(normalizedQuery.network || normalizedOptions.network) || this.defaultNetwork,
      genesis: ledger.genesis,
      transactions: limited,
      count: limited.length,
      nextCursor: null,
    };
  }

  async submitTransaction(payload, options = {}) {
    return this.appendTransaction(payload, options);
  }

  async healthCheck(options = {}) {
    const adapter = this.resolveAdapter(options.network);

    if (adapter && typeof adapter.healthCheck === 'function') {
      return adapter.healthCheck(options);
    }

    return {
      status: 'OK',
      provider: adapter ? adapter.name || adapter.provider || 'custom' : 'memory',
      network: normalizeString(options.network) || this.defaultNetwork,
      replaceable: true,
    };
  }
}

module.exports = {
  BlockchainService,
  createHttpError,
};