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

  async function onSubmit() {
    setSubmitting(true);
    setSubmissionState('pending');

    const payload = {
      brandId: 'brand-placeholder',
      productCode,
      packetCode,
      productImageUri,
      capturedAt: new Date().toISOString(),
    };

    try {
      await brandApi.createBlockchainRecord(payload);
      setSubmissionState('success');
    } catch {
      setSubmissionState('failed');
    } finally {
      setSubmitting(false);
      navigation.replace('SubmissionResult');
    }
  }

  return (
    <ScreenShell title="Review" subtitle="Confirm details for blockchain entry.">
      <View style={styles.card}>
        <Text style={styles.row}>Product Code: {productCode || 'Missing'}</Text>
        <Text style={styles.row}>Packet Code: {packetCode || 'Missing'}</Text>
        <Text style={styles.row}>Image: {productImageUri ? 'Captured' : 'Missing'}</Text>
      </View>
      <LargeActionButton
        label={submitting ? 'Submitting...' : 'Submit to Blockchain'}
        onPress={onSubmit}
        disabled={submitting || !productCode || !packetCode || !productImageUri}
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
  row: {
    fontSize: 17,
    color: '#0F172A',
  },
});
