import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { LargeActionButton } from "../components/LargeActionButton";
import { useDriverStore } from "../store/useDriverStore";
import { driverApi } from "../api/driverApi";

const STAGES = [
  "QR linked to ledger record",
  "AI integrity check",
  "Decision generated",
];

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function CaptureValidationScreen({ navigation }) {
  const [submitting, setSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState(-1);
  const payload = useDriverStore((s) => s.latestScanPayload);
  const selectedScenario = useDriverStore((s) => s.selectedScenario);
  const setSelectedScenario = useDriverStore((s) => s.setSelectedScenario);
  const setResult = useDriverStore((s) => s.setResult);

  async function onValidateAndQueue() {
    setSubmitting(true);

    try {
      setActiveStage(0);
      await delay(350);

      const scanReq = await driverApi.submitScan({
        packetCode: payload?.packetCode || "PACKET-DEMO-001",
        demoScenario: selectedScenario,
      });

      setActiveStage(1);
      await delay(450);

      const scanId = scanReq?.data?.scanId || scanReq?.scanId || "scan_001";
      const rawAiResult = await driverApi.getScanResult(scanId);
      const aiResult = rawAiResult?.data || rawAiResult;
      await delay(300);
      setActiveStage(2);

      setResult({ success: true, aiResult });
    } catch (error) {
      setResult({
        success: false,
        errorMessage: error?.response?.data?.error?.message || "Could not reach AI engine.",
      });
    } finally {
      setSubmitting(false);
      navigation.replace("Result");
    }
  }

  return (
    <ScreenShell
      eyebrow="Step 2"
      title="Run Deterministic AI Check"
      subtitle="Choose the demo outcome, then generate the logistics decision."
    >
      <View style={styles.payloadCard}>
        <Text style={styles.payloadLabel}>Packet selected</Text>
        <Text style={styles.payloadValue}>{payload?.packetCode || "No capture found"}</Text>
        <Text style={styles.payloadMeta}>
          {payload?.source === "camera"
            ? "Linked from captured package photo."
            : "Linked from the latest brand demo packet."}
        </Text>
      </View>

      <View style={styles.scenarioRow}>
        <Pressable
          style={[
            styles.scenarioCard,
            selectedScenario === "pass" && styles.scenarioCardActive,
          ]}
          onPress={() => setSelectedScenario("pass")}
          disabled={submitting}
        >
          <Text style={styles.scenarioTitle}>Verified shipment</Text>
          <Text style={styles.scenarioText}>Integrity verified, continue delivery.</Text>
        </Pressable>
        <Pressable
          style={[
            styles.scenarioCard,
            selectedScenario === "flag" && styles.scenarioAlertActive,
          ]}
          onPress={() => setSelectedScenario("flag")}
          disabled={submitting}
        >
          <Text style={styles.scenarioTitle}>Suspicious shipment</Text>
          <Text style={styles.scenarioText}>Flag and hold for manual review.</Text>
        </Pressable>
      </View>

      <View style={styles.stageList}>
        {STAGES.map((stage, index) => {
          const isComplete = activeStage > index;
          const isActive = activeStage === index;
          return (
            <View
              key={stage}
              style={[
                styles.stageCard,
                isComplete && styles.stageComplete,
                isActive && styles.stageActive,
              ]}
            >
              <Text style={styles.stageTitle}>{stage}</Text>
              <Text style={styles.stageMeta}>
                {isComplete ? "Completed" : isActive ? "Running..." : "Waiting"}
              </Text>
            </View>
          );
        })}
      </View>

      {submitting ? <ActivityIndicator size="large" color="#0B5FFF" /> : null}
      <LargeActionButton
        label={submitting ? "Generating Decision..." : "Submit AI Check"}
        onPress={onValidateAndQueue}
        disabled={submitting || !payload}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  payloadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 16,
    gap: 4,
  },
  payloadLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
    textTransform: "uppercase",
  },
  payloadValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  payloadMeta: {
    fontSize: 15,
    color: "#475569",
  },
  scenarioRow: {
    gap: 10,
  },
  scenarioCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 4,
  },
  scenarioCardActive: {
    borderColor: "#22C55E",
    backgroundColor: "#DCFCE7",
  },
  scenarioAlertActive: {
    borderColor: "#F97316",
    backgroundColor: "#FFEDD5",
  },
  scenarioTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  scenarioText: {
    fontSize: 15,
    color: "#475569",
  },
  stageList: {
    gap: 8,
  },
  stageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 4,
  },
  stageActive: {
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  stageComplete: {
    borderColor: "#22C55E",
    backgroundColor: "#DCFCE7",
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  stageMeta: {
    fontSize: 14,
    color: "#475569",
  },
});
