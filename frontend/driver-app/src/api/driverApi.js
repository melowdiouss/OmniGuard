import { apiClient } from './client';

/**
 * API integration layer only.
 */
export const driverApi = {
  /**
   * @param {{ email: string, role: 'driver' }} payload
   * @returns {Promise<{ data: import('./types').DemoSession }>}
   */
  async login(payload) {
    const { data } = await apiClient.post('/api/v1/auth/login', payload);
    return data;
  },

  /**
   * @param {import('./types').SubmitScanRequest} payload
   * @returns {Promise<{ data: import('./types').SubmitScanResponse }>}
   */
  async submitScan(payload) {
    const { data } = await apiClient.post('/api/v1/logistics/scans', payload);
    return data;
  },

  /**
   * @param {string} scanId
   * @returns {Promise<{ data: import('./types').ScanResultResponse }>}
   */
  async getScanResult(scanId) {
    const { data } = await apiClient.get(`/api/v1/logistics/scans/${scanId}/result`);
    return data;
  },

  /**
   * @returns {Promise<{ data: { items: import('./types').DriverHistoryItem[] } }>}
   */
  async getHistory() {
    const { data } = await apiClient.get('/api/v1/logistics/scans/history');
    return data;
  },

  /**
   * @returns {Promise<{ data: { items: import('./types').DriverRecordSummary[] } }>}
   */
  async getAvailableRecords() {
    const { data } = await apiClient.get('/api/v1/brand/blockchain/records');
    return data;
  },
};
