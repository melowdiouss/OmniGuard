import { create } from 'zustand';
import { setAuthToken } from '../api/client';

export const useBrandStore = create((set) => ({
  isLoggedIn: false,
  session: null,
  productCode: '',
  packetCode: '',
  productImageUri: '',
  submissionState: 'idle',
  latestRecord: null,
  records: [],

  login(session) {
    setAuthToken(session?.accessToken || null);
    set({ isLoggedIn: true, session });
  },

  logout() {
    setAuthToken(null);
    set({
      isLoggedIn: false,
      session: null,
      productCode: '',
      packetCode: '',
      productImageUri: '',
      submissionState: 'idle',
      latestRecord: null,
      records: [],
    });
  },

  setProductCode(productCode) {
    set({ productCode });
  },

  setPacketCode(packetCode) {
    set({ packetCode });
  },

  setProductImageUri(productImageUri) {
    set({ productImageUri });
  },

  setSubmissionState(submissionState) {
    set({ submissionState });
  },

  setRecords(records) {
    const items = Array.isArray(records) ? records : [];
    set((state) => ({
      records: items,
      latestRecord: items[0] || state.latestRecord,
    }));
  },

  setLatestRecord(latestRecord) {
    set((state) => ({
      latestRecord,
      records: latestRecord
        ? [latestRecord, ...state.records.filter((record) => record.recordId !== latestRecord.recordId)]
        : state.records,
    }));
  },

  resetFlow() {
    set({
      productCode: '',
      packetCode: '',
      productImageUri: '',
      submissionState: 'idle',
    });
  },
}));
