import React, { useState } from 'react';
import { ActivityIndicator, Text, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';

export function CaptureValidationScreen({ navigation }) {
  const [submitting, setSubmitting] = useState(false);
  const payload = useDriverStore((s) => s.latestScanPayload);
  const queueScanLocally = useDriverStore((s) => s.queueScanLocally);
  const setResult = useDriverStore((s) => s.setResult);

  async function onValidateAndQueue() {
    setSubmitting(true);

    const queuedItem = {
      localId: `${Date.now()}`,
      payload,
      queuedAt: new Date().toISOString(),
      syncStatus: 'PENDING',
    };

    try {
      await queueScanLocally(queuedItem);
      setResult({ success: true, queuedItem });
    } catch {
      setResult({ success: false, queuedItem });
    } finally {
      setSubmitting(false);
      navigation.replace('Result');
    }
  }

  return (
    <ScreenShell title="Validate Capture" subtitle="Confirm and queue this scan.">
      <Text style={styles.payload}>{payload ? 'Capture ready to queue.' : 'No capture found'}</Text>
      {submitting ? <ActivityIndicator size="large" color="#0B5FFF" /> : null}
      <LargeActionButton
        label={submitting ? 'Queuing...' : 'Queue Scan'}
        onPress={onValidateAndQueue}
        disabled={submitting || !payload}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  payload: {
    fontSize: 18,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    textAlign: 'center',
  },
});
