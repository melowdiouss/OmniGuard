import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function LargeActionButton({ label, onPress, disabled }) {
  return (
    <Pressable style={[styles.button, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 72,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#0B5FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  disabled: { opacity: 0.5 },
  label: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
});
