import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function LargeActionButton({ label, onPress, disabled, variant = 'primary' }) {
  return (
    <Pressable
      style={[
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'success' && styles.successButton,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.label,
          variant === 'secondary' && styles.secondaryLabel,
        ]}
      >
        {label}
      </Text>
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
  secondaryButton: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  successButton: {
    backgroundColor: '#15803D',
  },
  disabled: { opacity: 0.5 },
  label: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  secondaryLabel: {
    color: '#1E3A8A',
  },
});
