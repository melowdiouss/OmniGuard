import React, { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';
import { brandApi } from '../api/brandApi';
import { DEFAULT_API_BASE_URL } from '../api/client';

export function BrandLoginScreen({ navigation }) {
  const [email, setEmail] = useState('brand.demo@omniguard.app');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const login = useBrandStore((s) => s.login);
  const setRecords = useBrandStore((s) => s.setRecords);

  async function onLogin() {
    setSubmitting(true);
    setError('');

    try {
      const sessionResponse = await brandApi.login({
        email: email.trim() || 'brand.demo@omniguard.app',
        role: 'brand',
      });

      login(sessionResponse.data);
      navigation.replace('BrandDashboard');

      try {
        const recordsResponse = await brandApi.getBlockchainRecords();
        setRecords(recordsResponse.data?.items || []);
      } catch (recordsError) {
        setRecords([]);
      }
    } catch (loginError) {
      const errorMessage =
        loginError?.response?.data?.error?.message ||
        loginError?.message ||
        'Unknown error';
      setError(
        `Could not start demo session at ${DEFAULT_API_BASE_URL}. Error: ${errorMessage}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="Demo Entry"
      title="Brand Console Login"
      subtitle="Start the product-to-ledger workflow."
    >
      <TextInput
        style={styles.input}
        placeholder="brand.demo@omniguard.app"
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.hint}>Use the default demo identity or type any brand email.</Text>
      <Text style={styles.apiHint}>API: {DEFAULT_API_BASE_URL}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <LargeActionButton
        label={submitting ? 'Opening Dashboard...' : 'Enter Brand Dashboard'}
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
