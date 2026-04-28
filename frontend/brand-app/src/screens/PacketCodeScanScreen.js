import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function PacketCodeScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [captured, setCaptured] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);
  const setPacketCode = useBrandStore((s) => s.setPacketCode);

  async function onCaptureCode() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
      setPacketCode(`PACKET_CODE_${Date.now()}`);
      setCaptured(true);
    } finally {
      setCapturing(false);
    }
  }

  if (!permission) {
    return (
      <ScreenShell title="Packet Code" subtitle="Preparing camera.">
        <Text style={styles.info}>Loading camera...</Text>
      </ScreenShell>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenShell title="Camera Needed" subtitle="Allow access to scan packet code.">
        <LargeActionButton label="Allow Camera" onPress={requestPermission} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Scan Packet Code" subtitle="Scan barcode or QR on packet.">
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>
      {!captured ? (
        <LargeActionButton label={capturing ? 'Scanning...' : 'Scan Code'} onPress={onCaptureCode} disabled={capturing} />
      ) : (
        <LargeActionButton label="Continue" onPress={() => navigation.navigate('ReviewConfirm')} />
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
