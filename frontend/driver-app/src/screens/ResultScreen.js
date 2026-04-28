import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';

export function ResultScreen({ navigation }) {
  const result = useDriverStore((s) => s.lastResult);
  const success = result?.success;

  return (
    <ScreenShell
      title={success ? 'Queued' : 'Capture Failed'}
      subtitle={success ? 'Stored offline. Will sync when online.' : 'Please scan again.'}
    >
      <Text style={[styles.message, success ? styles.success : styles.failure]}>
        {success ? 'Scan saved to local queue.' : 'Could not process this capture.'}
      </Text>
      <LargeActionButton label={success ? 'Back to Home' : 'Try Again'} onPress={() => navigation.replace('Home')} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  message: {
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
