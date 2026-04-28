import { apiClient } from './client';

export const brandApi = {
  /**
   * @param {import('./types').DemoLoginRequest} payload
   * @returns {Promise<{ data: import('./types').DemoSession }>}
   */
  async login(payload) {
    const { data } = await apiClient.post('/api/v1/auth/login', payload);
    return data;
  },

  /**
   * @param {import('./types').CreateBlockchainRecordRequest} payload
   * @returns {Promise<import('./types').CreateBlockchainRecordResponse>}
   */
  async createBlockchainRecord(payload) {
    const { data } = await apiClient.post('/api/v1/brand/blockchain/records', payload);
    return data;
  },

  /**
   * @returns {Promise<{ data: { items: import('./types').BlockchainRecord[] } }>}
   */
  async getBlockchainRecords() {
    const { data } = await apiClient.get('/api/v1/brand/blockchain/records');
    return data;
  },
};
