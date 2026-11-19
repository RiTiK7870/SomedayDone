import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { computeTotals, fetchProfile, listGoals } from "../lib/goals";
import { userMessage } from "../lib/errors";
import { cancelAllReminders } from "../lib/reminders";
import { weeklyStepCounts } from "../lib/history";
import { WeeklyChart } from "../components/WeeklyChart";
import type { Goal } from "../types";
import { Button, Card, ErrorBanner } from "../components/ui";
import { colors, radius, space, type } from "../theme";

const PRIVACY = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "";
const TERMS = process.env.EXPO_PUBLIC_TERMS_URL ?? "";
const SUPPORT = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "";

export function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [totals, setTotals] = useState({
    goalsCreated: 0,
    goalsCompleted: 0,
    stepsCompleted: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const buckets = useMemo(() => weeklyStepCounts(goals), [goals]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const userId = session?.user.id;
      if (!userId) return;
      const [profile, goals] = await Promise.all([
        fetchProfile(userId),
        listGoals(),
      ]);
      setName(
        profile?.display_name ??
          (session?.user.user_metadata?.full_name as string | undefined) ??
          null,
      );
      setTotals(computeTotals(goals));
      setGoals(goals);
    } catch (e) {
      setError(userMessage(e));
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const email = session?.user.email ?? "";
  const initial = (name ?? email ?? "?").charAt(0).toUpperCase();

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account and every goal, step, and reminder. It cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      // Server removes the auth user; cascading foreign keys remove all app data.
      const { error: fnError } =
        await supabase.functions.invoke("delete-account");
      if (fnError) throw fnError;
      await cancelAllReminders();
      await signOut();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  async function signOutNow() {
    await cancelAllReminders();
    await signOut();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.hero}>Profile</Text>
        {error ? <ErrorBanner message={error} onRetry={load} /> : null}

        <Card style={styles.identity}>
          <View style={styles.avatar} accessibilityLabel="Profile initial">
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.title} numberOfLines={1}>
              {name ?? "Your account"}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </Card>

        <Card style={{ gap: space.sm }}>
          <Text style={type.title}>Your progress</Text>
          <Text style={type.body}>
            {totals.goalsCreated} dreams · {totals.goalsCompleted} finished ·{" "}
            {totals.stepsCompleted} steps done
          </Text>
          <Text style={[type.label, { marginTop: space.xs }]}>
            Steps done each week
          </Text>
          <WeeklyChart buckets={buckets} />
        </Card>

        <Card style={{ gap: space.sm }}>
          <Text style={type.title}>About</Text>
          {PRIVACY ? (
            <LinkRow
              label="Privacy Policy"
              onPress={() => Linking.openURL(PRIVACY)}
            />
          ) : null}
          {TERMS ? (
            <LinkRow
              label="Terms of Service"
              onPress={() => Linking.openURL(TERMS)}
            />
          ) : null}
          {SUPPORT ? (
            <LinkRow
              label="Contact support"
              onPress={() => Linking.openURL(`mailto:${SUPPORT}`)}
            />
          ) : null}
          <Text style={type.small}>
            Reminders are local to this phone. Turn them on per goal.
          </Text>
        </Card>

        <Button label="Sign out" variant="secondary" onPress={signOutNow} />

        <Card style={{ gap: space.sm, borderColor: "#E7C5BE" }}>
          <Text style={type.title}>Delete account</Text>
          <Text style={type.small}>
            Removes your account, goals, steps, and reminders from our servers.
          </Text>
          <Button
            label="Delete my account"
            variant="danger"
            onPress={confirmDelete}
            loading={deleting}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} style={styles.link}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: space.md, paddingBottom: space.xl, gap: space.md },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.sand, fontSize: 24, fontWeight: "700" },
  link: {
    color: colors.forest,
    fontWeight: "600",
    textDecorationLine: "underline",
    paddingVertical: 4,
  },
});
