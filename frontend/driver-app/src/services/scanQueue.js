import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'omniguard.driver.scanQueue';

export async function getQueuedScans() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function enqueueScan(scanItem) {
  const current = await getQueuedScans();
  const updated = [scanItem, ...current];
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
