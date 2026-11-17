import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithGoogle } from "../lib/auth";
import { userMessage } from "../lib/errors";
import { AuthCancelledError } from "../lib/errors";
import { Button, ErrorBanner } from "../components/ui";
import { colors, radius, space, type } from "../theme";

export function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      // Cancelling is a normal choice, so show a gentle hint rather than an error.
      if (e instanceof AuthCancelledError) setMessage(e.message);
      else setMessage(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Text style={type.hero}>SomedayDone</Text>
        <Text style={[type.body, styles.tagline]}>
          Stop dreaming about someday.{"\n"}Start doing today.
        </Text>

        <View style={styles.preview}>
          {/* Three swatches echo the brand palette without any imagery. */}
          <View style={[styles.swatch, { backgroundColor: colors.forest }]} />
          <View style={[styles.swatch, { backgroundColor: colors.purple }]} />
          <View
            style={[
              styles.swatch,
              {
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
              },
            ]}
          />
        </View>
        <Text style={[type.body, { color: colors.muted, textAlign: "center" }]}>
          One dream. A few small steps. Steady progress.
        </Text>
      </View>

      <View style={styles.bottom}>
        {message ? <ErrorBanner message={message} /> : null}
        <Button
          label="Continue with Google"
          onPress={onGoogle}
          loading={busy}
        />
        {/* <Text style={[type.small, styles.legal]}>
          By continuing you agree to our{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL ?? '')}>Terms</Text>
          {' '}and{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? '')}>Privacy Policy</Text>.
        </Text> */}
        {process.env.EXPO_PUBLIC_TERMS_URL &&
        process.env.EXPO_PUBLIC_PRIVACY_URL ? (
          <Text style={[type.small, styles.legal]}>
            By continuing you agree to our{" "}
            <Text
              style={styles.link}
              onPress={() =>
                Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL!)
              }
            >
              Terms
            </Text>{" "}
            and{" "}
            <Text
              style={styles.link}
              onPress={() =>
                Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL!)
              }
            >
              Privacy Policy
            </Text>
            .
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.sand,
    paddingHorizontal: space.lg,
    justifyContent: "space-between",
  },
  top: { flex: 1, justifyContent: "center", gap: space.md },
  tagline: { color: colors.forest },
  preview: {
    flexDirection: "row",
    gap: space.sm,
    alignSelf: "center",
    marginVertical: space.lg,
  },
  swatch: { width: 64, height: 88, borderRadius: radius.md },
  bottom: { paddingBottom: space.lg, gap: space.md },
  legal: { textAlign: "center" },
  link: {
    color: colors.forest,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});
