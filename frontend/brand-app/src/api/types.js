/**
 * API interface contracts only.
 */

/**
 * @typedef {Object} CreateBlockchainRecordRequest
 * @property {string} brandId
 * @property {string} productCode
 * @property {string} packetCode
 * @property {string} productImageUri
 * @property {string} capturedAt
 */

/**
 * @typedef {Object} CreateBlockchainRecordResponse
 * @property {string} blockId
 * @property {string} txId
 * @property {'PENDING'|'CONFIRMED'|'FAILED'} status
 */
