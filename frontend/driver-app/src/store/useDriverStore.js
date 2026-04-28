import { create } from 'zustand';
import { enqueueScan, getQueuedScans } from '../services/scanQueue';

export const useDriverStore = create((set, get) => ({
  isLoggedIn: false,
  latestScanPayload: '',
  lastResult: null,
  queueCount: 0,

  login() {
    set({ isLoggedIn: true });
  },

  logout() {
    set({ isLoggedIn: false });
  },

  setLatestScanPayload(payload) {
    set({ latestScanPayload: payload });
  },

  setResult(result) {
    set({ lastResult: result });
  },

  async queueScanLocally(scanItem) {
    const updated = await enqueueScan(scanItem);
    set({ queueCount: updated.length });
  },

  async refreshQueueCount() {
    const queued = await getQueuedScans();
    set({ queueCount: queued.length });
  },
}));
