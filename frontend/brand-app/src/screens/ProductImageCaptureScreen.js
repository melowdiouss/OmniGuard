import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function ProductImageCaptureScreen({ navigation }) {
  const [busy, setBusy] = useState(false);
  const productImageUri = useBrandStore((s) => s.productImageUri);
  const setProductImageUri = useBrandStore((s) => s.setProductImageUri);

  async function onCaptureImage() {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setProductImageUri(result.assets[0].uri);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenShell
      eyebrow="Step 2 of 4"
      title="Capture Product Evidence"
      subtitle="Attach a product image or use the sample asset."
    >
      <View style={styles.previewWrap}>
        {productImageUri && !productImageUri.startsWith('demo://') ? (
          <Image source={{ uri: productImageUri }} style={styles.preview} />
        ) : productImageUri ? (
          <Text style={styles.placeholder}>Demo sample image attached</Text>
        ) : (
          <Text style={styles.placeholder}>No image captured</Text>
        )}
      </View>
      {!productImageUri ? (
        <>
          <LargeActionButton
            label={busy ? 'Capturing...' : 'Capture Image'}
            onPress={onCaptureImage}
            disabled={busy}
          />
          <LargeActionButton
            label="Use Sample Image"
            onPress={() => setProductImageUri('demo://sample-image')}
            variant="secondary"
          />
        </>
      ) : (
        <>
          <Text style={styles.helperText}>
            {productImageUri.startsWith('demo://')
              ? 'Demo sample attached to this record.'
              : 'Captured image attached to this record.'}
          </Text>
          <LargeActionButton label="Continue" onPress={() => navigation.navigate('PacketCodeScan')} />
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { color: '#64748B', fontSize: 18 },
  helperText: {
    textAlign: 'center',
    color: '#334155',
    fontSize: 15,
  },
});
