import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function BrandLoginScreen({ navigation }) {
  const login = useBrandStore((s) => s.login);

  function onLogin() {
    login();
    navigation.replace('ProductCodeScan');
  }

  return (
    <ScreenShell title="Brand Login" subtitle="Enter brand ID to continue.">
      <TextInput style={styles.input} placeholder="Brand ID" placeholderTextColor="#64748B" />
      <LargeActionButton label="Continue" onPress={onLogin} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    minHeight: 64,
    fontSize: 22,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
});
