import { create } from 'zustand';

export const useBrandStore = create((set) => ({
  isLoggedIn: false,
  productCode: '',
  packetCode: '',
  productImageUri: '',
  submissionState: 'idle',

  login() {
    set({ isLoggedIn: true });
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

  resetFlow() {
    set({
      productCode: '',
      packetCode: '',
      productImageUri: '',
      submissionState: 'idle',
    });
  },
}));
