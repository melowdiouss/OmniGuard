import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenShell } from '../components/ScreenShell';
import { LargeActionButton } from '../components/LargeActionButton';
import { useDriverStore } from '../store/useDriverStore';
import { driverApi } from '../api/driverApi';

export function ScanScreen({ navigation }) {
  const [capturing, setCapturing] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [availableRecord, setAvailableRecord] = useState(null);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const latestScanPayload = useDriverStore((s) => s.latestScanPayload);
  const setLatestScanPayload = useDriverStore((s) => s.setLatestScanPayload);

  async function loadLatestRecord() {
    setLoadingRecord(true);
    setError('');
    try {
      const response = await driverApi.getAvailableRecords();
      const latest = response.data?.items?.[0] || null;
      setAvailableRecord(latest);
    } catch (loadError) {
      setError('Could not load brand records.');
    } finally {
      setLoadingRecord(false);
    }
  }

  useEffect(() => {
    loadLatestRecord();
  }, []);

  async function onCapture() {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    setError('');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });

      if (!availableRecord) {
        setError('No packet is registered yet. Create a brand record first.');
        return;
      }

      setLatestScanPayload({
        captureUri: photo?.uri || null,
        packetCode: availableRecord.packetCode,
        recordId: availableRecord.recordId,
        source: 'camera',
      });
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
      <ScreenShell
        eyebrow="Step 1"
        title="Camera Needed"
        subtitle="Allow camera access or continue with the latest brand demo packet."
      >
        <LargeActionButton label="Allow Camera" onPress={requestPermission} />
        <LargeActionButton
          label={loadingRecord ? 'Loading Packet...' : 'Use Latest Demo Packet'}
          onPress={() => {
            if (!availableRecord) {
              setError('No packet is registered yet. Create a brand record first.');
              return;
            }

            setLatestScanPayload({
              captureUri: null,
              packetCode: availableRecord.packetCode,
              recordId: availableRecord.recordId,
              source: 'demo-shortcut',
            });
            navigation.navigate('CaptureValidation');
          }}
          disabled={loadingRecord}
          variant="secondary"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="Step 1"
      title="Select Packet for Transit Scan"
      subtitle="Use the latest brand packet or capture a package photo first."
    >
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      </View>
      <View style={styles.recordCard}>
        <Text style={styles.recordLabel}>Latest registered packet</Text>
        <Text style={styles.recordValue}>
          {loadingRecord ? 'Loading...' : availableRecord?.packetCode || 'No registered packet found'}
        </Text>
        <Text style={styles.recordMeta}>
          {availableRecord
            ? `Record ${availableRecord.recordId} ready for transit scan`
            : 'Complete the brand app flow before verifying a packet.'}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!latestScanPayload ? (
        <>
          <LargeActionButton
            label={capturing ? 'Capturing...' : 'Capture Package Photo'}
            onPress={onCapture}
            disabled={capturing || loadingRecord}
          />
          <LargeActionButton
            label="Use Latest Demo Packet"
            onPress={() => {
              if (!availableRecord) {
                setError('No packet is registered yet. Create a brand record first.');
                return;
              }

              setLatestScanPayload({
                captureUri: null,
                packetCode: availableRecord.packetCode,
                recordId: availableRecord.recordId,
                source: 'demo-shortcut',
              });
            }}
            disabled={loadingRecord}
            variant="secondary"
          />
          <LargeActionButton
            label={loadingRecord ? 'Refreshing...' : 'Refresh Brand Records'}
            onPress={loadLatestRecord}
            disabled={loadingRecord}
            variant="secondary"
          />
        </>
      ) : (
        <>
          <View style={styles.selectedCard}>
            <Text style={styles.selectedTitle}>Packet selected for AI verification</Text>
            <Text style={styles.selectedValue}>{latestScanPayload.packetCode}</Text>
            <Text style={styles.selectedMeta}>
              Source: {latestScanPayload.source === 'camera' ? 'Captured package photo' : 'Demo packet shortcut'}
            </Text>
          </View>
        <LargeActionButton label="Continue" onPress={() => navigation.navigate('CaptureValidation')} />
        </>
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
  recordCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 4,
  },
  recordLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
  },
  recordValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordMeta: {
    fontSize: 15,
    color: '#475569',
  },
  selectedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 4,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
  },
  selectedValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectedMeta: {
    fontSize: 15,
    color: '#475569',
  },
  error: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
  info: {
    fontSize: 18,
    textAlign: 'center',
    color: '#334155',
  },
});
