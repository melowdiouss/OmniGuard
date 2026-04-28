import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';
import { brandApi } from '../api/brandApi';

export function ReviewConfirmScreen({ navigation }) {
  const [submitting, setSubmitting] = useState(false);
  const productCode = useBrandStore((s) => s.productCode);
  const packetCode = useBrandStore((s) => s.packetCode);
  const productImageUri = useBrandStore((s) => s.productImageUri);
  const setSubmissionState = useBrandStore((s) => s.setSubmissionState);
  const setLatestRecord = useBrandStore((s) => s.setLatestRecord);
  const capturedAt = new Date().toISOString();

  async function onSubmit() {
    setSubmitting(true);
    setSubmissionState('pending');

    const payload = {
      productCode,
      packetCode,
      productImageUri,
      capturedAt,
    };

    try {
      const response = await brandApi.createBlockchainRecord(payload);
      setLatestRecord(response.data);
      setSubmissionState('success');
    } catch {
      setSubmissionState('failed');
    } finally {
      setSubmitting(false);
      navigation.replace('SubmissionResult');
    }
  }

  return (
    <ScreenShell
      eyebrow="Step 4 of 4"
      title="Review Ledger Registration"
      subtitle="Confirm the shipment summary before writing to the demo ledger."
    >
      <View style={styles.card}>
        <Text style={styles.label}>Product code</Text>
        <Text style={styles.row}>{productCode || 'Missing'}</Text>
        <Text style={styles.label}>Packet code</Text>
        <Text style={styles.row}>{packetCode || 'Missing'}</Text>
        <Text style={styles.label}>Image source</Text>
        <Text style={styles.row}>
          {productImageUri ? (productImageUri.startsWith('demo://') ? 'Demo sample image' : 'Captured image') : 'Missing'}
        </Text>
        <Text style={styles.label}>Timeline status</Text>
        <Text style={styles.row}>Ready to be registered on ledger at {new Date(capturedAt).toLocaleTimeString()}</Text>
      </View>
      <LargeActionButton
        label={submitting ? 'Registering...' : 'Register on Ledger'}
        onPress={onSubmit}
        disabled={submitting || !productCode || !packetCode || !productImageUri}
        variant="success"
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  row: {
    fontSize: 17,
    color: '#0F172A',
    fontWeight: '600',
  },
});
