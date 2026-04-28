import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function ProductCodeScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [captured, setCaptured] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);
  const setProductCode = useBrandStore((s) => s.setProductCode);

  async function onCaptureCode() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
      setProductCode(`PRODUCT_CODE_${Date.now()}`);
      setCaptured(true);
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
      <ScreenShell title="Camera Needed" subtitle="Allow access to scan product code.">
        <LargeActionButton label="Allow Camera" onPress={requestPermission} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Scan Product Code" subtitle="Scan barcode or QR of product.">
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>
      {!captured ? (
        <LargeActionButton label={capturing ? 'Scanning...' : 'Scan Code'} onPress={onCaptureCode} disabled={capturing} />
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
});
