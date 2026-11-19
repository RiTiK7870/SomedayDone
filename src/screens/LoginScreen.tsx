import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { signInWithGoogle } from "../lib/auth";
import { userMessage, AuthCancelledError } from "../lib/errors";
import { ErrorBanner } from "../components/ui";
import { colors, displayFont, radius, space, type } from "../theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

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

  const terms = process.env.EXPO_PUBLIC_TERMS_URL;
  const privacy = process.env.EXPO_PUBLIC_PRIVACY_URL;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={26} color={colors.sand} />
        </View>
        <Text style={styles.hero}>SomedayDone</Text>
        <Text style={styles.tagline}>
          Stop dreaming about someday.{"\n"}Start doing today.
        </Text>

        <View style={styles.features}>
          <Feature icon="flag-outline" text="Name the dream you keep putting off" />
          <Feature icon="footsteps-outline" text="Break it into small, doable steps" />
          <Feature icon="notifications-outline" text="Get a gentle nudge when you choose" />
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Welcome</Text>
        <Text style={styles.sheetBody}>
          Sign in to pick up where you left off.
        </Text>

        {message ? <ErrorBanner message={message} /> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ disabled: busy, busy }}
          onPress={onGoogle}
          disabled={busy}
          style={({ pressed }) => [
            styles.googleBtn,
            { opacity: busy ? 0.7 : pressed ? 0.85 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.forest} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.forest} />
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {terms && privacy ? (
          <Text style={styles.legal}>
            By continuing you agree to our{" "}
            <Text style={styles.link} onPress={() => Linking.openURL(terms)}>
              Terms
            </Text>{" "}
            and{" "}
            <Text style={styles.link} onPress={() => Linking.openURL(privacy)}>
              Privacy Policy
            </Text>
            .
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Feature({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={colors.purple} />
      </View>
      <Text style={[type.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sand,
    paddingHorizontal: space.lg,
    justifyContent: "space-between",
  },
  top: { flex: 1, justifyContent: "center", gap: space.sm },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  hero: { ...type.hero, fontSize: 36, lineHeight: 42 },
  tagline: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.muted,
    marginBottom: space.lg,
  },
  features: { gap: space.sm },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    backgroundColor: colors.forest,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    marginBottom: space.md,
  },
  sheetTitle: {
    fontFamily: displayFont,
    fontSize: 24,
    fontWeight: "700",
    color: colors.sand,
  },
  sheetBody: { fontSize: 15, lineHeight: 22, color: "#C9D6CC" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.sand,
  },
  googleText: { fontSize: 16, fontWeight: "700", color: colors.forest },
  legal: { fontSize: 13, lineHeight: 18, color: "#C9D6CC", textAlign: "center" },
  link: {
    color: colors.sand,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});
