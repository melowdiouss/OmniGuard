import React, { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';
import { driverApi } from '../api/driverApi';
import { DEFAULT_API_BASE_URL } from '../api/client';

export function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('driver.demo@omniguard.app');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const login = useDriverStore((s) => s.login);

  async function onLogin() {
    setSubmitting(true);
    setError('');

    try {
      const sessionResponse = await driverApi.login({
        email: email.trim() || 'driver.demo@omniguard.app',
        role: 'driver',
      });
      login(sessionResponse.data);
      navigation.replace('Home');
    } catch (loginError) {
      const errorMessage =
        loginError?.response?.data?.error?.message ||
        loginError?.message ||
        'Unknown error';
      setError(
        `Could not start driver session at ${DEFAULT_API_BASE_URL}. Error: ${errorMessage}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="Transit Entry"
      title="Driver Verification Login"
      subtitle="Open the logistics verification workflow."
    >
      <TextInput
        style={styles.input}
        placeholder="driver.demo@omniguard.app"
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.hint}>Use the default driver identity or type any logistics email.</Text>
      <Text style={styles.apiHint}>API: {DEFAULT_API_BASE_URL}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <LargeActionButton
        label={submitting ? 'Starting Session...' : 'Enter Transit Dashboard'}
        onPress={onLogin}
        disabled={submitting}
      />
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
  hint: {
    fontSize: 15,
    color: '#334155',
    textAlign: 'center',
  },
  apiHint: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  error: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
});
