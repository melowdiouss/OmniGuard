import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { LargeActionButton } from "../components/LargeActionButton";
import { useDriverStore } from "../store/useDriverStore";

export function ResultScreen({ navigation }) {
  const result = useDriverStore((s) => s.lastResult);
  const success = result?.success;

  const aiResult = result?.aiResult;
  const verified = aiResult?.status === "verified";
  const confidence = aiResult?.aiConfidence ? Math.round(aiResult.aiConfidence * 100) : 0;
  const decision = aiResult?.decision || "UNKNOWN";
  const statusCardStyle = !success
    ? styles.failure
    : verified
      ? styles.success
      : styles.warning;

  return (
    <ScreenShell
      eyebrow="Verification Outcome"
      title={success ? (verified ? "Integrity Verified" : "Shipment Flagged") : "Checking Failed"}
      subtitle={
        success
          ? verified
            ? "Transit scan matches the registered packet."
            : "This packet should be held for review."
          : "Please retry the verification flow."
      }
    >
      <Text style={[styles.message, statusCardStyle]}>
        {success ? `${decision} decision` : result?.errorMessage || "Could not reach AI engine."}
      </Text>
      {success && aiResult ? (
        <View style={styles.detailsCard}>
          <Text style={styles.line}>Packet code: {aiResult.packetCode}</Text>
          <Text style={styles.line}>Record ID: {aiResult.recordId}</Text>
          <Text style={styles.line}>Status: {aiResult.status}</Text>
          <Text style={styles.line}>Confidence: {confidence}%</Text>
          <Text style={styles.line}>Recommended action: {aiResult.recommendedAction}</Text>
          <Text style={styles.line}>Reasons:</Text>
          {aiResult.reasons.map((reason) => (
            <Text key={reason} style={styles.reasonLine}>- {reason}</Text>
          ))}
        </View>
      ) : null}
      <LargeActionButton label="Back to Home" onPress={() => navigation.replace("Home")} />
      {success ? (
        <LargeActionButton
          label="Open History"
          onPress={() => navigation.replace("History")}
          variant="secondary"
        />
      ) : (
        <LargeActionButton
          label="Try Again"
          onPress={() => navigation.replace("Scan")}
          variant="secondary"
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    borderRadius: 14,
    padding: 20,
  },
  success: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  warning: {
    backgroundColor: "#FFEDD5",
    color: "#9A3412",
  },
  failure: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    gap: 6,
  },
  line: {
    fontSize: 16,
    color: "#0F172A",
  },
  reasonLine: {
    fontSize: 15,
    color: "#334155",
  },
});
