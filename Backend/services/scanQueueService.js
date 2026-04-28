const crypto = require('crypto');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callRedisMethod(redisClient, methodNames, ...args) {
  if (!redisClient) {
    return null;
  }

  for (const methodName of methodNames) {
    if (typeof redisClient[methodName] === 'function') {
      return redisClient[methodName](...args);
    }
  }

  return null;
}

class ScanQueueService {
  constructor({ redisClient = null, logger = console, queueKey = 'scan:validation:queue' } = {}) {
    this.redisClient = redisClient;
    this.logger = logger;
    this.queueKey = queueKey;
    this.memoryQueue = [];
    this.processing = false;
    this.workerActive = false;
  }

  async enqueue(job) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      throw new Error('Scan job must be a plain object');
    }

    const payload = {
      ...job,
      jobId: job.jobId || crypto.randomUUID(),
      enqueuedAt: new Date().toISOString(),
      attempts: Number.isFinite(job.attempts) ? job.attempts : 0,
    };

    const serialized = JSON.stringify(payload);

    const redisResult = await callRedisMethod(this.redisClient, ['rPush', 'rpush'], this.queueKey, serialized)
      || await callRedisMethod(this.redisClient, ['lPush', 'lpush'], this.queueKey, serialized);

    if (redisResult !== null && redisResult !== undefined) {
      return payload;
    }

    this.memoryQueue.push(payload);
    this._scheduleDrain();

    return payload;
  }

  _scheduleDrain() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    setImmediate(async () => {
      try {
        while (this.memoryQueue.length > 0 && this.workerActive && typeof this.workerHandler === 'function') {
          const job = this.memoryQueue.shift();
          await this._handleJob(job);
        }
      } finally {
        this.processing = false;
      }
    });
  }

  async _handleJob(job) {
    try {
      await this.workerHandler(job);
    } catch (error) {
      if (this.logger && typeof this.logger.error === 'function') {
        this.logger.error('[ScanQueue] Job processing failed', {
          jobId: job?.jobId,
          scanId: job?.scanId,
          message: error.message,
          stack: error.stack,
        });
      }
    }
  }

  async startWorker(handler, { pollIntervalMs = 25 } = {}) {
    if (typeof handler !== 'function') {
      throw new Error('ScanQueueService.startWorker requires a handler function');
    }

    this.workerHandler = handler;
    this.workerActive = true;

    if (this.redisClient) {
      this._startRedisWorkerLoop(pollIntervalMs).catch((error) => {
        if (this.logger && typeof this.logger.error === 'function') {
          this.logger.error('[ScanQueue] Redis worker loop failed', {
            message: error.message,
            stack: error.stack,
          });
        }
      });
      return;
    }

    this._scheduleDrain();
  }

  async _startRedisWorkerLoop(pollIntervalMs) {
    while (this.workerActive) {
      const result = await callRedisMethod(
        this.redisClient,
        ['bLPop', 'blPop', 'brPop', 'bRPop'],
        this.queueKey,
        pollIntervalMs,
      );

      if (!this.workerActive) {
        break;
      }

      if (!result) {
        await sleep(pollIntervalMs);
        continue;
      }

      const rawJob = Array.isArray(result) ? result[1] : result.element || result.value || result;

      let job = rawJob;
      if (typeof rawJob === 'string') {
        try {
          job = JSON.parse(rawJob);
        } catch (error) {
          if (this.logger && typeof this.logger.error === 'function') {
            this.logger.error('[ScanQueue] Failed to parse queued job', {
              message: error.message,
              rawJob,
            });
          }
          continue;
        }
      }

      await this._handleJob(job);
    }
  }

  stopWorker() {
    this.workerActive = false;
  }
}

module.exports = {
  ScanQueueService,
};