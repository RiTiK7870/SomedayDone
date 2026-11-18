import React, { useCallback, useState } from "react";
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
  sortedSteps,
} from "../lib/goals";
import { userMessage } from "../lib/errors";
import type { Goal, Step } from "../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ProgressBar,
} from "../components/ui";
import { calcProgress } from "../lib/progress";
import { colors, radius, space, type } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // const load = useCallback(async () => {
  //   try {
  //     setError(null);
  //     setGoals(await listGoals());
  //   } catch (e) {
  //     setError(userMessage(e));
  //   } finally {
  //     setLoading(false);
  //   }
  // }, []);
  const load = useCallback(async () => {
    try {
      setError(null);
      setGoals(await listGoals());
    } catch (e) {
      const err = e as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
        status?: number;
      };

      console.error("HOME LOAD ERROR:", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        status: err.status,
      });

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

  const firstName = (
    session?.user.user_metadata?.full_name as string | undefined
  )?.split(" ")[0];
  const active = goals.filter(isActive);
  const next = nextStepsFor(goals, 3);
  const totals = computeTotals(goals);

  async function toggle(goal: Goal, step: Step) {
    try {
      await setStepDone(goal, step, !step.is_completed);
      await load();
    } catch (e) {
      setError(userMessage(e));
    }
  }

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
        <View>
          <Text style={type.hero}>
            {firstName ? `Hi, ${firstName}` : "Hello"}
          </Text>
          <Text style={[type.body, { color: colors.muted }]}>
            {active.length === 0
              ? "Pick one dream to start."
              : `${active.length} ${active.length === 1 ? "dream" : "dreams"} in progress.`}
          </Text>
        </View>

        {error ? <ErrorBanner message={error} onRetry={load} /> : null}

        {!loading && goals.length === 0 && !error ? (
          <EmptyState
            title="Start with one dream"
            body="Write down something you want to do someday. We will help you break it into small steps."
            actionLabel="New goal"
            onAction={() => navigation.navigate("GoalForm")}
          />
        ) : null}

        {next.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Text style={type.title}>Next steps</Text>
            {next.map(({ goal, step }) => (
              <Card key={step.id} style={styles.nextRow}>
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
                  onPress={() =>
                    navigation.navigate("GoalDetail", { goalId: goal.id })
                  }
                  style={{ flex: 1, gap: 2 }}
                >
                  <Text style={type.label}>{step.title}</Text>
                  <Text style={type.small} numberOfLines={1}>
                    {goal.title}
                  </Text>
                </Pressable>
              </Card>
            ))}
          </View>
        ) : null}

        {active.slice(0, 3).map((goal) => {
          const p = calcProgress(goal.goal_steps);
          return (
            <Pressable
              key={goal.id}
              accessibilityRole="button"
              accessibilityLabel={`${goal.title}, ${p.percent ?? 0} percent`}
              onPress={() =>
                navigation.navigate("GoalDetail", { goalId: goal.id })
              }
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <Card style={{ gap: space.sm }}>
                <Text style={type.title} numberOfLines={1}>
                  {goal.title}
                </Text>
                {p.percent !== null ? (
                  <>
                    <ProgressBar percent={p.percent} />
                    <Text style={type.small}>
                      {p.done} of {p.total} steps
                    </Text>
                  </>
                ) : (
                  <Text style={type.small}>Add steps to track progress</Text>
                )}
              </Card>
            </Pressable>
          );
        })}

        {goals.length > 0 ? (
          <Card style={styles.totals}>
            <Stat label="Dreams" value={totals.goalsCreated} />
            <Stat label="Finished" value={totals.goalsCompleted} />
            <Stat label="Steps done" value={totals.stepsCompleted} />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[type.title, { fontSize: 26 }]}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: space.md, paddingBottom: 120, gap: space.lg },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 12,
  },
  checkbox: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  totals: { flexDirection: "row", paddingVertical: space.md },
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
