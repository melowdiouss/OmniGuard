import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function ScreenShell({ title, subtitle, children }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.body}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  title: { fontSize: 32, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 16, color: '#334155' },
  body: { flex: 1, justifyContent: 'center', gap: 12 },
});
