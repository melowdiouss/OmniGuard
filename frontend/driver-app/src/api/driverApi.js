import { apiClient } from './client';

/**
 * API integration layer only.
 */
export const driverApi = {
  /**
   * @param {import('./types').SubmitScanRequest} payload
   * @returns {Promise<import('./types').SubmitScanResponse>}
   */
  async submitScan(payload) {
    const { data } = await apiClient.post('/api/v1/logistics/scans', payload);
    return data;
  },

  /**
   * @param {string} scanId
   * @returns {Promise<import('./types').ScanResultResponse>}
   */
  async getScanResult(scanId) {
    const { data } = await apiClient.get(`/api/v1/logistics/scans/${scanId}/result`);
    return data;
  },

  /**
   * @returns {Promise<{ items: import('./types').DriverHistoryItem[] }>} 
   */
  async getHistory() {
    const { data } = await apiClient.get('/api/v1/logistics/scans/history');
    return data;
  },
};
