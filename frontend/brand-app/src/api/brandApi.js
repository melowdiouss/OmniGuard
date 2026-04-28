import { apiClient } from './client';

export const brandApi = {
  /**
   * @param {import('./types').CreateBlockchainRecordRequest} payload
   * @returns {Promise<import('./types').CreateBlockchainRecordResponse>}
   */
  async createBlockchainRecord(payload) {
    const { data } = await apiClient.post('/api/v1/brand/blockchain/records', payload);
    return data;
  },
};
