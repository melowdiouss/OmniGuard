/**
 * API contracts only. No backend logic here.
 */

/**
 * @typedef {Object} DemoSession
 * @property {{ id: string, email: string, role: string, orgId: string, displayName: string }} user
 * @property {string} accessToken
 * @property {string} refreshToken
 */

/**
 * @typedef {Object} DriverRecordSummary
 * @property {string} recordId
 * @property {string} productCode
 * @property {string} packetCode
 * @property {string} blockchainTxHash
 * @property {'registered'} status
 * @property {string} createdAt
 */

/**
 * @typedef {Object} SubmitScanRequest
 * @property {string} packetCode
 * @property {'pass'|'flag'} demoScenario
 */

/**
 * @typedef {Object} SubmitScanResponse
 * @property {string} scanId
 * @property {string} recordId
 * @property {string} packetCode
 * @property {'queued'} status
 * @property {string} message
 * @property {'pass'|'flag'} demoScenario
 */

/**
 * @typedef {Object} ScanResultResponse
 * @property {string} scanId
 * @property {string} recordId
 * @property {string} packetCode
 * @property {'verified'|'flagged'} status
 * @property {'PASS'|'HOLD'} decision
 * @property {number} aiConfidence
 * @property {string[]} reasons
 * @property {string} recommendedAction
 * @property {string} scannedAt
 */

/**
 * @typedef {Object} DriverHistoryItem
 * @property {string} scanId
 * @property {string} recordId
 * @property {string} packetCode
 * @property {'verified'|'flagged'} status
 * @property {'PASS'|'HOLD'} decision
 * @property {number} aiConfidence
 * @property {string[]} reasons
 * @property {string} recommendedAction
 * @property {string} scannedAt
 * @property {'pass'|'flag'} demoScenario
 */
