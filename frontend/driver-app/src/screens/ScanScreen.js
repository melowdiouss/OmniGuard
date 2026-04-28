import React, { useRef, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';

export function ScanScreen({ navigation }) {
  const [captured, setCaptured] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const setLatestScanPayload = useDriverStore((s) => s.setLatestScanPayload);

  async function onCapture() {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      setLatestScanPayload(photo?.uri || '');
      setCaptured(true);
    } finally {
      setCapturing(false);
    }
  }

  if (!permission) {
    return (
      <ScreenShell title="Scan" subtitle="Checking camera access.">
        <Text style={styles.info}>Preparing camera...</Text>
      </ScreenShell>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenShell title="Camera Needed" subtitle="Allow camera access to scan shipments.">
        <LargeActionButton label="Allow Camera" onPress={requestPermission} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Scan" subtitle="Center the package code and capture.">
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>
      {!captured ? (
        <LargeActionButton label={capturing ? 'Capturing...' : 'Capture'} onPress={onCapture} disabled={capturing} />
      ) : (
        <LargeActionButton label="Continue" onPress={() => navigation.navigate('CaptureValidation')} />
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
  camera: {
    flex: 1,
  },
  info: {
    fontSize: 18,
    textAlign: 'center',
    color: '#334155',
  },
});
