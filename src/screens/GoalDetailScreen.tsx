import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  addStep,
  deleteGoal,
  deleteReminder,
  deleteStep,
  getGoal,
  progressFor,
  saveReminder,
  setGoalStatus,
  completeGoal,
  resetGoalSteps,
  setReminderEnabled,
  setStepDone,
  sortedSteps,
  swapSteps,
  isActive,
} from "../lib/goals";
import { userMessage, AppError } from "../lib/errors";
import { isValidDate, isValidTime, validateStepTitle } from "../lib/validate";
import {
  cancelReminder,
  hasNotificationPermission,
  nextFireDate,
  openSystemNotificationSettings,
  scheduleReminder,
} from "../lib/reminders";
import { useAuth } from "../context/AuthContext";
import { STATUS_LABEL } from "../types";
import type { Frequency, Goal, Step } from "../types";
import {
  Button,
  Card,
  Chip,
  ErrorBanner,
  Field,
  ProgressBar,
} from "../components/ui";
import { colors, radius, space, type } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GoalDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "GoalDetail">>();
  const { goalId } = route.params;
  const { session } = useAuth();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newStep, setNewStep] = useState("");
  const [freq, setFreq] = useState<Frequency>("daily");
  const [time, setTime] = useState("08:00");
  const [date, setDate] = useState("");
  const [permissionOff, setPermissionOff] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const g = await getGoal(goalId);
      setGoal(g);
      const r = Array.isArray(g.reminders) ? g.reminders[0] : undefined;
      if (r) {
        const d = new Date(r.reminder_time);
        setFreq(r.frequency);
        setTime(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        );
        setDate(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        );
      }
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Runs a write, then reloads. Blocks double taps and reports failures without losing input.
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      Alert.alert("Could not save", userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !goal) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={[type.body, styles.center]}>Loading…</Text>
      </SafeAreaView>
    );
  }
  if (!goal) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: space.md }}>
          <ErrorBanner
            message={error ?? "This goal is no longer available."}
            onRetry={load}
          />
        </View>
      </SafeAreaView>
    );
  }

  const steps = sortedSteps(goal);
  const progress = progressFor(goal);
  const reminder = Array.isArray(goal.reminders)
    ? goal.reminders[0]
    : undefined;
  const canComplete = goal.status !== "completed" && goal.status !== "archived";
  const allStepsDone =
    progress.total > 0 && progress.done === progress.total && canComplete;

  async function addNewStep() {
    const problem = validateStepTitle(newStep);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    await run(async () => {
      await addStep(goal!, newStep);
      setNewStep("");
    });
  }

  function toggleStep(step: Step) {
    run(() => setStepDone(goal!, step, !step.is_completed));
  }

  function move(index: number, direction: -1 | 1) {
    const other = steps[index + direction];
    if (!other) return;
    run(() => swapSteps(steps[index], other));
  }

  function confirmRemoveStep(step: Step) {
    Alert.alert("Remove this step?", step.title, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => run(() => deleteStep(step.id)),
      },
    ]);
  }

  function markComplete() {
    run(async () => {
      await completeGoal(goal!.id);

      if (reminder) {
        await cancelReminder(reminder.notification_id);
        await setReminderEnabled(goal!.id, false, null);
      }
    });
  }

  function reopen() {
    const anyDone = steps.some((s) => s.is_completed);
    run(() => setGoalStatus(goal!.id, anyDone ? "in_progress" : "not_started"));
  }

  function archiveOrRestore() {
    if (goal!.status === "archived") {
      const anyDone = steps.some((s) => s.is_completed);
      run(() =>
        setGoalStatus(goal!.id, anyDone ? "in_progress" : "not_started"),
      );
    } else {
      run(() => setGoalStatus(goal!.id, "archived"));
    }
  }

  function confirmDeleteGoal() {
    Alert.alert(
      "Delete this goal?",
      "Its steps and reminder will be deleted too. This cannot be undone.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await cancelReminder(reminder?.notification_id);
            run(async () => {
              await deleteGoal(goal!.id);
              navigation.goBack();
            });
          },
        },
      ],
    );
  }

  async function saveReminderNow() {
    if (!isValidTime(time)) return setError("Use 24-hour time, like 08:30.");
    if (freq === "once" && !isValidDate(date))
      return setError("Pick a date in the format YYYY-MM-DD.");

    const [hh, mm] = time.split(":").map(Number);
    let stored: Date;
    if (freq === "once") {
      const [y, m, d] = date.split("-").map(Number);
      stored = new Date(y, m - 1, d, hh, mm, 0, 0);
      if (stored <= new Date())
        return setError("That time has already passed. Pick a later one.");
    } else {
      stored = new Date();
      stored.setHours(hh, mm, 0, 0);
    }
    setError(null);

    const userId = session?.user.id;
    if (!userId) return;

    run(async () => {
      try {
        const fireAt = nextFireDate(freq, stored);
        await cancelReminder(reminder?.notification_id);
        const notificationId = await scheduleReminder({
          goalId: goal!.id,
          goalTitle: goal!.title,
          frequency: freq,
          fireAt,
        });
        await saveReminder(goal!, {
          userId,
          reminderTime: fireAt,
          frequency: freq,
          notificationId,
          isEnabled: true,
        });

        setPermissionOff(false);

        Alert.alert(
          "Reminder set successfully!",
          "Your reminder has been saved and scheduled.",
        );
      } catch (e) {
        if (e instanceof AppError && e.code === "PERMISSION_DENIED") {
          setPermissionOff(true);
          return;
        }
        throw e;
      }
    });
  }

  async function onSaveReminderPress() {
    // Explain before the system permission prompt appears.
    if (!(await hasNotificationPermission())) {
      Alert.alert(
        "Turn on reminders?",
        "SomedayDone uses notifications only for the reminders you set here.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Continue", onPress: saveReminderNow },
        ],
      );
      return;
    }
    saveReminderNow();
  }

  function pauseOrResume() {
    if (!reminder) return;
    if (reminder.is_enabled) {
      run(async () => {
        await cancelReminder(reminder.notification_id);
        await setReminderEnabled(goal!.id, false, null);
      });
    } else {
      run(async () => {
        const fireAt = nextFireDate(
          reminder.frequency,
          new Date(reminder.reminder_time),
        );
        const id = await scheduleReminder({
          goalId: goal!.id,
          goalTitle: goal!.title,
          frequency: reminder.frequency,
          fireAt,
        });
        await setReminderEnabled(goal!.id, true, id);
      });
    }
  }

  function removeReminder() {
    run(async () => {
      await cancelReminder(reminder?.notification_id);
      await deleteReminder(goal!.id);
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.xs }}>
          <Text style={type.hero}>{goal.title}</Text>
          <Text style={type.small}>
            {goal.category} · {STATUS_LABEL[goal.status]}
            {goal.target_date ? ` · Target ${goal.target_date}` : ""}
          </Text>
          {goal.description ? (
            <Text style={[type.body, { marginTop: space.xs }]}>
              {goal.description}
            </Text>
          ) : null}
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        <Card style={{ gap: space.sm }}>
          {progress.percent !== null ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                }}
              >
                <Text style={[type.hero, { fontSize: 44, lineHeight: 50 }]}>
                  {progress.percent}%
                </Text>
                <Text style={type.small}>
                  {progress.done} of {progress.total} steps
                </Text>
              </View>
              <ProgressBar percent={progress.percent} />
            </>
          ) : (
            <Text style={type.body}>Add steps to track progress.</Text>
          )}
        </Card>

        {allStepsDone ? (
          <Card
            style={{
              gap: space.sm,
              backgroundColor: colors.purpleSoft,
              borderColor: colors.purple,
            }}
          >
            <Text style={type.title}>Every step is done.</Text>
            <Text style={type.body}>Mark this dream complete?</Text>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button
                label="Mark complete"
                onPress={markComplete}
                style={{ flex: 1 }}
              />
              <Button
                label="Not yet"
                variant="ghost"
                onPress={() => run(() => resetGoalSteps(goal!.id))}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Text style={type.title}>Steps</Text>
          {steps.length === 0 ? (
            <Text style={type.small}>
              Break this dream into small steps you can finish.
            </Text>
          ) : null}
          {steps.map((step, index) => (
            <Card key={step.id} style={styles.stepRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={step.title}
                accessibilityState={{ checked: step.is_completed }}
                onPress={() => toggleStep(step)}
                hitSlop={8}
              >
                <Ionicons
                  name={
                    step.is_completed ? "checkmark-circle" : "ellipse-outline"
                  }
                  size={26}
                  color={step.is_completed ? colors.purple : colors.forest}
                />
              </Pressable>
              <Text
                style={[
                  type.body,
                  {
                    flex: 1,
                    textDecorationLine: step.is_completed
                      ? "line-through"
                      : "none",
                    opacity: step.is_completed ? 0.6 : 1,
                  },
                ]}
              >
                {step.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Move step up"
                onPress={() => move(index, -1)}
                hitSlop={6}
                disabled={index === 0}
              >
                <Ionicons
                  name="chevron-up"
                  size={20}
                  color={index === 0 ? colors.line : colors.forest}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Move step down"
                onPress={() => move(index, 1)}
                hitSlop={6}
                disabled={index === steps.length - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={
                    index === steps.length - 1 ? colors.line : colors.forest
                  }
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${step.title}`}
                onPress={() => confirmRemoveStep(step)}
                hitSlop={6}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </Card>
          ))}

          <View
            style={{
              flexDirection: "row",
              gap: space.sm,
              alignItems: "flex-end",
            }}
          >
            <View style={{ flex: 1 }}>
              <Field
                label="Add a step"
                value={newStep}
                onChangeText={setNewStep}
                placeholder="Find a beginner recipe book"
                maxLength={200}
                returnKeyType="done"
                onSubmitEditing={addNewStep}
              />
            </View>
            <Button
              label="Add"
              onPress={addNewStep}
              disabled={!newStep.trim()}
              style={{ paddingHorizontal: space.md, minHeight: 52 }}
            />
          </View>
        </View>

        <Card style={{ gap: space.sm }}>
          <Text style={type.title}>Reminder</Text>
          {permissionOff ? (
            <View style={{ gap: space.sm }}>
              <Text style={type.body}>
                Notifications are off, so reminders can't run. Turn them on in
                your phone settings.
              </Text>
              <Button
                label="Open notification settings"
                variant="secondary"
                onPress={openSystemNotificationSettings}
              />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: space.xs }}>
            <Chip
              label="Daily"
              selected={freq === "daily"}
              onPress={() => setFreq("daily")}
            />
            <Chip
              label="Once"
              selected={freq === "once"}
              onPress={() => setFreq("once")}
            />
          </View>
          <Field
            label="Time (24-hour)"
            value={time}
            onChangeText={setTime}
            placeholder="08:00"
            maxLength={5}
            keyboardType="numbers-and-punctuation"
          />
          {freq === "once" ? (
            <Field
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              autoCapitalize="none"
            />
          ) : null}

          <Button
            label={reminder ? "Update reminder" : "Set reminder"}
            onPress={onSaveReminderPress}
            loading={busy}
          />

          {reminder ? (
            <View style={{ gap: space.xs }}>
              <Text style={type.small}>
                {reminder.is_enabled ? "On" : "Paused"} ·{" "}
                {reminder.frequency === "daily" ? "every day" : "once"} ·
                reminders use this phone's time zone
              </Text>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button
                  label={reminder.is_enabled ? "Pause" : "Resume"}
                  variant="ghost"
                  onPress={pauseOrResume}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Remove"
                  variant="ghost"
                  onPress={removeReminder}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : null}
        </Card>

        <View style={{ gap: space.sm }}>
          {canComplete && !allStepsDone ? (
            <Button
              label="Mark goal complete"
              variant="secondary"
              onPress={markComplete}
            />
          ) : null}
          {goal.status === "completed" ? (
            <Button label="Reopen goal" variant="secondary" onPress={reopen} />
          ) : null}
          <Button
            label="Edit goal"
            variant="ghost"
            onPress={() => navigation.navigate("GoalForm", { goalId: goal.id })}
          />
          <Button
            label={goal.status === "archived" ? "Restore goal" : "Archive goal"}
            variant="ghost"
            onPress={archiveOrRestore}
          />
          <Button
            label="Delete goal"
            variant="danger"
            onPress={confirmDeleteGoal}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xl },
  center: { textAlign: "center", marginTop: space.xl },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 12,
  },
});
