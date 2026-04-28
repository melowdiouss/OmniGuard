import React, { useEffect, useState } from 'react';
import { FlatList, Text, View, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { getQueuedScans } from '../services/scanQueue';

export function HistoryScreen() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      const queued = await getQueuedScans();
      setItems(queued);
    }
    load();
  }, []);

  return (
    <ScreenShell title="History" subtitle="Offline queued scans.">
      <FlatList
        data={items}
        keyExtractor={(item) => item.localId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.main}>{item.payload}</Text>
            <Text style={styles.meta}>{item.syncStatus}</Text>
            <Text style={styles.meta}>{item.queuedAt}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No queued scans.</Text>}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    gap: 4,
  },
  main: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  meta: {
    fontSize: 14,
    color: '#475569',
  },
  empty: {
    textAlign: 'center',
    fontSize: 18,
    color: '#64748B',
    marginTop: 24,
  },
});
