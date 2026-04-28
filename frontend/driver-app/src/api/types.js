/**
 * API contracts only. No backend logic here.
 */

export const ScanSyncStatus = {
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
};

/**
 * @typedef {Object} SubmitScanRequest
 * @property {string} shipmentId
 * @property {string} scanPayload
 * @property {string} capturedAt
 */

/**
 * @typedef {Object} SubmitScanResponse
 * @property {string} scanId
 * @property {'QUEUED'|'ACCEPTED'} status
 */

/**
 * @typedef {Object} ScanResultResponse
 * @property {string} scanId
 * @property {'SUCCESS'|'FAILURE'|'PENDING'} status
 * @property {string=} reasonCode
 */

/**
 * @typedef {Object} DriverHistoryItem
 * @property {string} scanId
 * @property {string} shipmentId
 * @property {string} scannedAt
 * @property {'SUCCESS'|'FAILURE'|'PENDING'} status
 */
