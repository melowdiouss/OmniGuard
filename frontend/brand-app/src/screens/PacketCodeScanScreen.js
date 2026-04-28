import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useBrandStore } from '../store/useBrandStore';

export function PacketCodeScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);
  const packetCode = useBrandStore((s) => s.packetCode);
  const setPacketCode = useBrandStore((s) => s.setPacketCode);

  async function onCaptureCode() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
      setPacketCode(`PACKET-LIVE-${Date.now()}`);
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
      <ScreenShell
        eyebrow="Step 3 of 4"
        title="Camera Needed"
        subtitle="Allow access to scan the packet code, or continue with the demo packet."
      >
        <LargeActionButton label="Allow Camera" onPress={requestPermission} />
        <LargeActionButton
          label="Use Demo Packet Code"
          onPress={() => {
            setPacketCode('PACKET-DEMO-001');
            navigation.navigate('ReviewConfirm');
          }}
          variant="secondary"
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="Step 3 of 4"
      title="Bind Packet to Product"
      subtitle="Scan the parcel identifier or use the shared demo packet."
    >
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Selected packet code</Text>
        <Text style={styles.summaryValue}>{packetCode || 'No packet code selected yet'}</Text>
      </View>
      {!packetCode ? (
        <>
          <LargeActionButton
            label={capturing ? 'Scanning...' : 'Scan Packet Code'}
            onPress={onCaptureCode}
            disabled={capturing}
          />
          <LargeActionButton
            label="Use Demo Packet Code"
            onPress={() => setPacketCode('PACKET-DEMO-001')}
            variant="secondary"
          />
        </>
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
