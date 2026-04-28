import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';

export function HomeScreen({ navigation }) {
  const queueCount = useDriverStore((s) => s.queueCount);
  const refreshQueueCount = useDriverStore((s) => s.refreshQueueCount);

  useEffect(() => {
    refreshQueueCount();
  }, [refreshQueueCount]);

  return (
    <ScreenShell title="Ready to Scan" subtitle="One shipment at a time.">
      <Text style={styles.note}>Queued offline: {queueCount}</Text>
      <LargeActionButton label="Start Scan" onPress={() => navigation.navigate('Scan')} />
      <LargeActionButton label="View History" onPress={() => navigation.navigate('History')} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
});
