import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function ProductCodeScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);
  const productCode = useBrandStore((s) => s.productCode);
  const setProductCode = useBrandStore((s) => s.setProductCode);

  async function onCaptureCode() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
      setProductCode(`PRODUCT-LIVE-${Date.now()}`);
    } finally {
      setCapturing(false);
    }
  }

  if (!permission) {
    return (
      <ScreenShell title="Product Code" subtitle="Preparing camera.">
        <Text style={styles.info}>Loading camera...</Text>
      </ScreenShell>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenShell
        eyebrow="Step 1 of 4"
        title="Camera Needed"
        subtitle="Allow access to scan the product code, or continue with the demo code."
      >
        <LargeActionButton label="Allow Camera" onPress={requestPermission} />
        <LargeActionButton
          label="Use Demo Product Code"
          onPress={() => {
            setProductCode('PRODUCT-DEMO-001');
            navigation.navigate('ProductImageCapture');
          }}
          variant="secondary"
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="Step 1 of 4"
      title="Capture Product Identity"
      subtitle="Scan the internal product code or use the demo shortcut."
    >
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Selected product code</Text>
        <Text style={styles.summaryValue}>{productCode || 'No product code selected yet'}</Text>
      </View>
      {!productCode ? (
        <>
          <LargeActionButton
            label={capturing ? 'Scanning...' : 'Scan Product Code'}
            onPress={onCaptureCode}
            disabled={capturing}
          />
          <LargeActionButton
            label="Use Demo Product Code"
            onPress={() => setProductCode('PRODUCT-DEMO-001')}
            variant="secondary"
          />
        </>
      ) : (
        <LargeActionButton label="Continue" onPress={() => navigation.navigate('ProductImageCapture')} />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  camera: { flex: 1 },
  info: { textAlign: 'center', fontSize: 18, color: '#334155' },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
});
