import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function SubmissionResultScreen({ navigation }) {
  const submissionState = useBrandStore((s) => s.submissionState);
  const latestRecord = useBrandStore((s) => s.latestRecord);
  const resetFlow = useBrandStore((s) => s.resetFlow);

  const isSuccess = submissionState === 'success';

  function onDone() {
    if (isSuccess) {
      resetFlow();
      navigation.replace('BrandDashboard');
      return;
    }

    navigation.replace('ReviewConfirm');
  }

  return (
    <ScreenShell
      eyebrow="Ledger Outcome"
      title={isSuccess ? 'Record Registered' : 'Registration Failed'}
      subtitle={
        isSuccess
          ? 'The packet is now ready for transit verification.'
          : 'The demo backend did not accept the record.'
      }
    >
      <Text style={[styles.status, isSuccess ? styles.success : styles.failure]}>
        {isSuccess ? 'Registered on ledger' : 'Submission failed'}
      </Text>
      {isSuccess && latestRecord ? (
        <View style={styles.card}>
          <Text style={styles.line}>Record ID: {latestRecord.recordId}</Text>
          <Text style={styles.line}>Packet: {latestRecord.packetCode}</Text>
          <Text style={styles.line}>TX Hash: {latestRecord.blockchainTxHash}</Text>
          <Text style={styles.line}>Next step: Ready for logistics verification</Text>
        </View>
      ) : null}
      <LargeActionButton
        label={isSuccess ? 'Back to Dashboard' : 'Try Again'}
        onPress={onDone}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  status: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    borderRadius: 14,
    padding: 20,
  },
  success: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  failure: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 8,
  },
  line: {
    fontSize: 16,
    color: '#0F172A',
  },
});
