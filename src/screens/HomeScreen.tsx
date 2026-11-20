import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";
import {
  computeTotals,
  listGoals,
  nextStepsFor,
  setStepDone,
  isActive,
  progressFor,
} from "../lib/goals";
import { userMessage } from "../lib/errors";
import { subscribeUndo } from "../lib/undo";
import { currentStreak } from "../lib/streaks";
import { registerPushIfAllowed } from "../lib/push";
import { listIncomingInvites } from "../lib/partners";
import type { Goal, Step } from "../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ProgressBar,
} from "../components/ui";
import { colors, radius, space, type } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteCount, setInviteCount] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      setGoals(await listGoals());
    } catch (e) {
      console.error("HOME LOAD ERROR:", e);
      setError(userMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => subscribeUndo(() => { load(); }), [load]);

  useEffect(() => {
    if (!session?.user.id) return;
    registerPushIfAllowed().catch(() => undefined);
  }, [session?.user.id]);

  const inviteEmail = session?.user.email ?? "";
  useFocusEffect(
    useCallback(() => {
      if (!inviteEmail) return;
      listIncomingInvites(inviteEmail)
        .then((rows) => setInviteCount(rows.length))
        .catch(() => setInviteCount(0));
    }, [inviteEmail]),
  );

  const firstName = (
    session?.user.user_metadata?.full_name as string | undefined
  )?.split(" ")[0];
  const active = goals.filter(isActive);
  const next = nextStepsFor(goals, 4);
  const totals = computeTotals(goals);

  const now = new Date();
  const todayLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  async function toggle(goal: Goal, step: Step) {
    try {
      await setStepDone(goal, step, !step.is_completed);
      await load();
    } catch (e) {
      setError(userMessage(e));
    }
  }

  const summaryLine =
    active.length === 0
      ? "Pick one dream to start."
      : `${active.length} ${active.length === 1 ? "dream" : "dreams"} in progress`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.purple}
          />
        }
      >
        <View style={{ gap: 2 }}>
          <Text style={type.small}>{todayLabel}</Text>
          <Text style={type.hero}>
            {firstName ? `Hi, ${firstName}` : "Hello"}
          </Text>
        </View>

        {inviteCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("Partners")}
            style={styles.inviteBanner}
          >
            <Ionicons name="people-outline" size={22} color={colors.purple} />
            <Text style={[type.label, { flex: 1 }]}>
              {inviteCount === 1
                ? "A friend invited you to follow a goal"
                : `${inviteCount} friends invited you to follow goals`}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}

        {error ? <ErrorBanner message={error} onRetry={load} /> : null}

        {goals.length > 0 ? (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{summaryLine}</Text>
            <View style={styles.statRow}>
              <Stat label="Dreams" value={totals.goalsCreated} />
              <View style={styles.statDivider} />
              <Stat label="Finished" value={totals.goalsCompleted} />
              <View style={styles.statDivider} />
              <Stat label="Steps done" value={totals.stepsCompleted} />
              <View style={styles.statDivider} />
              <Stat label="Day streak" value={currentStreak(goals)} />
            </View>
          </View>
        ) : null}

        {!loading && goals.length === 0 && !error ? (
          <EmptyState
            title="Start with one dream"
            body="Write down something you want to do someday. We will help you break it into small steps."
            actionLabel="New goal"
            onAction={() => navigation.navigate("GoalForm")}
          />
        ) : null}

        {next.length > 0 ? (
          <Section
            title="Up next"
            subtitle="Tap a circle when a step is done."
          >
            {next.map(({ goal, step }) => (
              <Card key={step.id} style={styles.stepCard}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Mark done: ${step.title}`}
                  accessibilityState={{ checked: step.is_completed }}
                  onPress={() => toggle(goal, step)}
                  hitSlop={10}
                  style={styles.checkbox}
                >
                  <Ionicons
                    name="ellipse-outline"
                    size={26}
                    color={colors.purple}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${step.title}, from ${goal.title}`}
                  onPress={() =>
                    navigation.navigate("GoalDetail", { goalId: goal.id })
                  }
                  style={{ flex: 1, gap: 4 }}
                >
                  <Text style={type.label}>{step.title}</Text>
                  <View style={styles.goalTag}>
                    <View style={styles.goalDot} />
                    <Text style={styles.goalTagText} numberOfLines={1}>
                      {goal.title}
                    </Text>
                  </View>
                </Pressable>
                <Ionicons name="chevron-forward" size={18} color={colors.line} />
              </Card>
            ))}
          </Section>
        ) : null}

        {active.length > 0 ? (
          <Section
            title="Dreams in progress"
            subtitle="Swipe to see them all."
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tileRow}
            >
              {active.map((goal) => {
                const p = progressFor(goal);
                return (
                  <Pressable
                    key={goal.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${goal.title}, ${p.percent ?? 0} percent`}
                    onPress={() =>
                      navigation.navigate("GoalDetail", { goalId: goal.id })
                    }
                    style={({ pressed }) => [
                      styles.tile,
                      { opacity: pressed ? 0.9 : 1 },
                    ]}
                  >
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryText}>{goal.category}</Text>
                    </View>
                    <Text style={type.title} numberOfLines={2}>
                      {goal.title}
                    </Text>
                    {p.percent !== null ? (
                      <>
                        <View style={styles.percentRow}>
                          <Text style={styles.percent}>{p.percent}%</Text>
                          <Text style={type.small}>
                            {p.done} of {p.total} steps
                          </Text>
                        </View>
                        <ProgressBar percent={p.percent} />
                      </>
                    ) : (
                      <Text style={type.small}>Add steps to track progress</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>
        ) : null}

        {goals.length > 0 && active.length === 0 ? (
          <Card style={{ alignItems: "center", gap: space.xs }}>
            <Ionicons name="trophy-outline" size={28} color={colors.purple} />
            <Text style={type.title}>All dreams are finished or archived.</Text>
            <Text style={[type.small, { textAlign: "center" }]}>
              Start a new one whenever you are ready.
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.fabWrap}>
        <Button
          label="New goal"
          onPress={() => navigation.navigate("GoalForm")}
          style={styles.fab}
        />
      </View>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ gap: 2 }}>
        <Text style={type.title}>{title}</Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: space.md, paddingBottom: 120, gap: space.lg },

  inviteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  summary: {
    backgroundColor: colors.forest,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  summaryTitle: { fontSize: 18, fontWeight: "700", color: colors.sand },
  statRow: { flexDirection: "row", alignItems: "center" },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(232,220,196,0.25)",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.sand,
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontSize: 13, color: "#C9D6CC", marginTop: 2 },

  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 12,
  },
  checkbox: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  goalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.purple,
  },
  goalTagText: { fontSize: 13, color: colors.muted, flexShrink: 1 },

  tileRow: { gap: space.sm, paddingRight: space.md },
  tile: {
    width: 248,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.sm,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 12, fontWeight: "700", color: colors.forest },
  percentRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  percent: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.purple,
  },

  fabWrap: {
    position: "absolute",
    left: space.md,
    right: space.md,
    bottom: space.md,
  },
  fab: {
    backgroundColor: colors.purple,
    shadowColor: colors.forest,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
