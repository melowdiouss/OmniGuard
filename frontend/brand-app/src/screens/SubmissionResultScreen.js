import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function SubmissionResultScreen({ navigation }) {
  const submissionState = useBrandStore((s) => s.submissionState);
  const resetFlow = useBrandStore((s) => s.resetFlow);

  const isSuccess = submissionState === 'success';

  function onDone() {
    resetFlow();
    navigation.replace('ProductCodeScan');
  }

  return (
    <ScreenShell
      title={isSuccess ? 'Submitted' : 'Submission Failed'}
      subtitle={isSuccess ? 'Record request sent successfully.' : 'Please try submitting again.'}
    >
      <Text style={[styles.status, isSuccess ? styles.success : styles.failure]}>
        {isSuccess ? 'Blockchain record request accepted.' : 'Blockchain record request failed.'}
      </Text>
      <LargeActionButton label={isSuccess ? 'Create Next Record' : 'Try Again'} onPress={onDone} />
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
});
