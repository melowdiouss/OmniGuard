/**
 * API interface contracts only.
 */

/**
 * @typedef {Object} DemoLoginRequest
 * @property {string} email
 * @property {'brand'} role
 */

/**
 * @typedef {Object} DemoSession
 * @property {{ id: string, email: string, role: string, orgId: string, displayName: string }} user
 * @property {string} accessToken
 * @property {string} refreshToken
 */

/**
 * @typedef {Object} CreateBlockchainRecordRequest
 * @property {string} productCode
 * @property {string} packetCode
 * @property {string} productImageUri
 * @property {string} capturedAt
 */

/**
 * @typedef {Object} BlockchainRecord
 * @property {string} recordId
 * @property {string} productCode
 * @property {string} packetCode
 * @property {string} productImageUri
 * @property {string} blockchainTxHash
 * @property {'registered'} status
 * @property {string} createdAt
 * @property {string} timelineLabel
 */

/**
 * @typedef {Object} CreateBlockchainRecordResponse
 * @property {BlockchainRecord} data
 */
