import { create } from 'zustand';
import { setAuthToken } from '../api/client';

export const useDriverStore = create((set) => ({
  isLoggedIn: false,
  session: null,
  latestScanPayload: null,
  selectedScenario: 'pass',
  lastResult: null,

  login(session) {
    setAuthToken(session?.accessToken || null);
    set({ isLoggedIn: true, session });
  },

  logout() {
    setAuthToken(null);
    set({
      isLoggedIn: false,
      session: null,
      latestScanPayload: null,
      selectedScenario: 'pass',
      lastResult: null,
    });
  },

  setLatestScanPayload(payload) {
    set({ latestScanPayload: payload });
  },

  setSelectedScenario(selectedScenario) {
    set({ selectedScenario });
  },

  setResult(result) {
    set({ lastResult: result });
  },

  resetFlow() {
    set({
      latestScanPayload: null,
      selectedScenario: 'pass',
      lastResult: null,
    });
  },
}));
