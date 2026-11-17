import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { listGoals, sortGoals } from "../lib/goals";
import { userMessage } from "../lib/errors";
import { CATEGORIES, STATUS_LABEL, STATUSES } from "../types";
import type { Goal, GoalStatus, Category } from "../types";
import { Button, Chip, EmptyState, ErrorBanner } from "../components/ui";
import { GoalCard } from "../components/GoalCard";
import { colors, radius, space, type } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type StatusFilter = GoalStatus | "all";
type CategoryFilter = Category | "all";

export function GoalsScreen() {
  const navigation = useNavigation<Nav>();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const load = useCallback(async () => {
    try {
      setError(null);
      setGoals(await listGoals());
    } catch (e) {
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = goals.filter((g) => {
      if (status !== "all" && g.status !== status) return false;
      if (category !== "all" && g.category !== category) return false;
      if (q && !g.title.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortGoals(filtered);
  }, [goals, query, status, category]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={type.hero}>My goals</Text>
        <TextInput
          accessibilityLabel="Search goals by title"
          placeholder="Search by title"
          placeholderTextColor="#7D8C80"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
          returnKeyType="search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All"
            selected={status === "all"}
            onPress={() => setStatus("all")}
          />
          {STATUSES.map((s) => (
            <Chip
              key={s}
              label={STATUS_LABEL[s]}
              selected={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="Any category"
            selected={category === "all"}
            onPress={() => setCategory("all")}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: space.md }}>
          <ErrorBanner message={error} onRetry={load} />
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.purple}
          />
        }
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onPress={() =>
              navigation.navigate("GoalDetail", { goalId: item.id })
            }
          />
        )}
        ListEmptyComponent={
          !loading ? (
            goals.length === 0 ? (
              <EmptyState
                title="No goals yet"
                body="Add a dream you have been putting off. Small steps make it real."
                actionLabel="New goal"
                onAction={() => navigation.navigate("GoalForm")}
              />
            ) : (
              <EmptyState
                title="Nothing matches"
                body="Try a different search or clear the filters."
              />
            )
          ) : (
            <></>
          )
        }
      />

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  header: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.forest,
  },
  chipRow: { paddingVertical: 2 },
  list: { padding: space.md, paddingBottom: 120 },
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
