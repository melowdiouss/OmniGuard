import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';

export function LoginScreen({ navigation }) {
  const login = useDriverStore((s) => s.login);

  function onLogin() {
    login();
    navigation.replace('Home');
  }

  return (
    <ScreenShell title="Driver Login" subtitle="Enter your ID and continue.">
      <TextInput style={styles.input} placeholder="Driver ID" placeholderTextColor="#64748B" />
      <LargeActionButton label="Login" onPress={onLogin} />
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
