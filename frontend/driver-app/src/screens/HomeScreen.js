import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';

export function HomeScreen({ navigation }) {
  const result = useDriverStore((s) => s.lastResult);
  const resetFlow = useDriverStore((s) => s.resetFlow);
  const latestDecision = result?.aiResult?.decision;
  const latestPacket = result?.aiResult?.packetCode;

  return (
    <ScreenShell
      eyebrow="Transit Dashboard"
      title="Shipment Integrity Check"
      subtitle="Verify the packet against the ledger and surface a pass or hold decision."
    >
      <View style={styles.card}>
        <Text style={styles.noteLabel}>Latest outcome</Text>
        <Text style={styles.noteValue}>{latestDecision || 'No verification run yet'}</Text>
        <Text style={styles.noteMeta}>
          {latestPacket ? `Packet ${latestPacket}` : 'Start a scan after the brand registers a packet.'}
        </Text>
      </View>
      <LargeActionButton
        label="Start Transit Scan"
        onPress={() => {
          resetFlow();
          navigation.navigate('Scan');
        }}
      />
      <LargeActionButton
        label="View Verification History"
        onPress={() => navigation.navigate('History')}
        variant="secondary"
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
  },
  noteValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  noteMeta: {
    fontSize: 15,
    color: '#475569',
  },
});
