import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function ScreenShell({ title, subtitle, children, eyebrow, alignTop = false }) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={[styles.body, alignTop && styles.bodyTop]}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF4FF' },
  content: { flex: 1, paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#1D4ED8',
  },
  title: { fontSize: 32, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 16, color: '#334155' },
  body: { flex: 1, justifyContent: 'center', gap: 12 },
  bodyTop: { justifyContent: 'flex-start' },
});
