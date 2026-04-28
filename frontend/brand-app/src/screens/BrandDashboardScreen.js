import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { brandApi } from '../api/brandApi';
import { useBrandStore } from '../store/useBrandStore';

function formatDate(value) {
  if (!value) {
    return 'Not available';
  }
  return new Date(value).toLocaleString();
}

export function BrandDashboardScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const records = useBrandStore((s) => s.records);
  const latestRecord = useBrandStore((s) => s.latestRecord);
  const setRecords = useBrandStore((s) => s.setRecords);
  const resetFlow = useBrandStore((s) => s.resetFlow);

  async function loadRecords() {
    setRefreshing(true);
    try {
      const response = await brandApi.getBlockchainRecords();
      setRecords(response.data?.items || []);
    } catch (error) {
      setRecords([]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  function onCreateRecord() {
    resetFlow();
    navigation.navigate('ProductCodeScan');
  }

  return (
    <ScreenShell
      eyebrow="Brand Mission Control"
      title="Ledger Registration Dashboard"
      subtitle="Create a shipment record, then hand the packet to logistics."
      alignTop
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Latest registered packet</Text>
          <Text style={styles.heroValue}>{latestRecord?.packetCode || 'No packet registered yet'}</Text>
          <Text style={styles.heroMeta}>
            {latestRecord
              ? `TX ${latestRecord.blockchainTxHash.slice(0, 18)}...`
              : 'Create your first demo ledger record to continue.'}
          </Text>
        </View>

        <LargeActionButton label="Create Ledger Record" onPress={onCreateRecord} />
        <LargeActionButton
          label={refreshing ? 'Refreshing...' : 'Refresh Records'}
          onPress={loadRecords}
          disabled={refreshing}
          variant="secondary"
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent records</Text>
          {records.length ? (
            records.map((record) => (
              <View key={record.recordId} style={styles.recordCard}>
                <Text style={styles.recordTitle}>{record.packetCode}</Text>
                <Text style={styles.recordLine}>Product: {record.productCode}</Text>
                <Text style={styles.recordLine}>Status: Registered on ledger</Text>
                <Text style={styles.recordLine}>Record ID: {record.recordId}</Text>
                <Text style={styles.recordLine}>TX: {record.blockchainTxHash}</Text>
                <Text style={styles.recordLine}>Created: {formatDate(record.createdAt)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No records yet. Start with a new ledger registration.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 14,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#1D4ED8',
    gap: 6,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DBEAFE',
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroMeta: {
    fontSize: 15,
    color: '#E0E7FF',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 4,
  },
  recordTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordLine: {
    fontSize: 15,
    color: '#334155',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyText: {
    fontSize: 16,
    color: '#475569',
  },
});
