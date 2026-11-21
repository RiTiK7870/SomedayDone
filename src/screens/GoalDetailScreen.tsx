import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { StepSuggester } from "../components/StepSuggester";
import { scheduleDeletion, subscribeUndo } from "../lib/undo";
import { shareGoalProgress } from "../lib/share";
import { PartnersCard } from "../components/PartnersCard";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  addStep,
  deleteGoal,
  deleteReminder,
  deleteStep,
  getGoal,
  fetchReminder,
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
  cancelGoalNotifications,
  countScheduledFor,
  hasNotificationPermission,
  nextFireDate,
  openSystemNotificationSettings,
  scheduleReminder,
} from "../lib/reminders";
import { useAuth } from "../context/AuthContext";
import { STATUS_LABEL } from "../types";
import type { Frequency, Goal, Reminder, Step } from "../types";
import {
  Button,
  Card,
  Chip,
  ErrorBanner,
  Field,
  ProgressBar,
} from "../components/ui";
import {
  DateField,
  TimeField,
  formatIsoDate,
  formatTime12,
  toHHMM,
  toIsoDate,
} from "../components/DateTimePicker";
import { colors, radius, space, type } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Stops a goal's reminder: cancels its notifications and marks it paused in the database.
async function stopGoalReminder(
  goalId: string,
  notificationId: string | null | undefined,
) {
  await cancelReminder(notificationId);
  await cancelGoalNotifications(goalId);
  await setReminderEnabled(goalId, false, null);
}

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
  // true while the reminder form is open for a goal that already has a reminder.
  const [editing, setEditing] = useState(false);
  // The saved reminder, read directly from the reminders table.
  const [savedReminder, setSavedReminder] = useState<Reminder | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [g, fetched] = await Promise.all([
        getGoal(goalId),
        fetchReminder(goalId),
      ]);
      setGoal(g);
      const r =
        fetched ?? (Array.isArray(g.reminders) ? g.reminders[0] : undefined);
      setSavedReminder(r ?? null);

      // A one-time reminder whose time has passed is finished. Clear it so the user can set a new one.
      if (
        r &&
        r.frequency === "once" &&
        new Date(r.reminder_time).getTime() <= Date.now()
      ) {
        await cancelReminder(r.notification_id);
        await deleteReminder(goalId);
        setSavedReminder(null);
      }

      // A finished or archived goal must not keep reminding. Stop any leftover reminder.
      if (r && r.is_enabled && !isActive(g)) {
        await stopGoalReminder(goalId, r.notification_id);
        setSavedReminder({ ...r, is_enabled: false, notification_id: null });
      }
      if (r) {
        const d = new Date(r.reminder_time);
        setFreq(r.frequency);
        setTime(toHHMM(d));
        setDate(toIsoDate(d));
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

  // Refresh when a deletion is undone or committed elsewhere.
  useEffect(
    () =>
      subscribeUndo(() => {
        load();
      }),
    [load],
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
  const reminder: Reminder | undefined = savedReminder ?? undefined;
  const goalActive = isActive(goal);
  const canComplete = goal.status !== "completed" && goal.status !== "archived";
  const allStepsDone =
    progress.total > 0 && progress.done === progress.total && canComplete;

  // Human-readable summary of the saved reminder, e.g. "Every day at 8:00 AM".
  const reminderWhen = reminder
    ? reminder.frequency === "daily"
      ? `Every day at ${formatTime12(toHHMM(new Date(reminder.reminder_time)))}`
      : `Once on ${formatIsoDate(toIsoDate(new Date(reminder.reminder_time)))} at ${formatTime12(toHHMM(new Date(reminder.reminder_time)))}`
    : "";

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

  // Hides the step straight away; it is deleted after the undo window unless undone.
  function confirmRemoveStep(step: Step) {
    scheduleDeletion(`step:${step.id}`, step.title, () => deleteStep(step.id));
    load();
  }

  function markComplete() {
    run(async () => {
      if (reminder) await stopGoalReminder(goal!.id, reminder.notification_id);
      await completeGoal(goal!.id);
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
      run(async () => {
        if (reminder)
          await stopGoalReminder(goal!.id, reminder.notification_id);
        await setGoalStatus(goal!.id, "archived");
      });
    }
  }

  function confirmDeleteGoal() {
    Alert.alert(
      "Delete this goal?",
      "Its steps and reminder will be deleted. You can undo this for a few seconds.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const id = goal!.id;
            const notificationId = reminder?.notification_id;
            scheduleDeletion(`goal:${id}`, goal!.title, async () => {
              await cancelReminder(notificationId);
              await cancelGoalNotifications(id);
              await deleteGoal(id);
            });
            navigation.goBack();
          },
        },
      ],
    );
  }

  // Opens the reminder form for a goal that already has one (the "Reset" action).
  function startEditing() {
    setError(null);
    setEditing(true);
  }

  // Closes the form without saving and restores the saved values.
  function cancelEditing() {
    setEditing(false);
    setError(null);
    load();
  }

  async function saveReminderNow() {
    if (!isValidTime(time)) return setError("Pick a time for the reminder.");
    if (freq === "once" && !isValidDate(date))
      return setError("Pick a date for the reminder.");

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
        setEditing(false);

        Alert.alert(
          "Reminder set",
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
    if (!reminder || !goalActive) return;
    if (reminder.is_enabled) {
      run(() => stopGoalReminder(goal!.id, reminder.notification_id));
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
      setEditing(false);
    });
  }

  const showReminderForm = goalActive && (!reminder || editing);

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
            {goal.target_date
              ? ` · Target ${formatIsoDate(goal.target_date)}`
              : ""}
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

        <Button
          label="Share progress"
          variant="secondary"
          onPress={() => shareGoalProgress(goal, session?.user.id)}
        />

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
          <StepSuggester
            goal={goal}
            onAdded={() => {
              load();
            }}
          />
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
              {!step.is_completed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Focus on ${step.title}`}
                  onPress={() =>
                    navigation.navigate("Focus", {
                      goalId: goal.id,
                      stepId: step.id,
                    })
                  }
                  hitSlop={6}
                >
                  <Ionicons
                    name="timer-outline"
                    size={20}
                    color={colors.purple}
                  />
                </Pressable>
              ) : null}
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

        {goal.user_id === session?.user.id ? (
          <PartnersCard goal={goal} />
        ) : null}

        <Card style={{ gap: space.md }}>
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

          {reminder && !editing ? (
            <View style={{ gap: space.md }}>
              <View style={styles.reminderSummary}>
                <View style={styles.reminderIcon}>
                  <Ionicons
                    name={
                      reminder.is_enabled
                        ? "notifications"
                        : "notifications-off-outline"
                    }
                    size={20}
                    color={colors.purple}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.label}>{reminderWhen}</Text>
                  <Text style={type.small}>
                    {reminder.is_enabled ? "On" : "Paused"} · uses this phone's
                    time zone
                  </Text>
                </View>
              </View>

              {goalActive ? (
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Button
                    label={reminder.is_enabled ? "Pause" : "Resume"}
                    variant="ghost"
                    onPress={pauseOrResume}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Reset"
                    variant="secondary"
                    onPress={startEditing}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <Text style={type.small}>
                  This goal is finished, so its reminder has stopped.
                </Text>
              )}

              <Button
                label="Remove reminder"
                variant="danger"
                onPress={removeReminder}
              />
            </View>
          ) : null}

          {!goalActive && !reminder ? (
            <Text style={type.small}>
              Reminders are for active goals. Reopen or restore this goal to set
              one.
            </Text>
          ) : null}

          {showReminderForm ? (
            <View style={{ gap: space.md }}>
              <View>
                <Text style={[type.small, { marginBottom: space.xs }]}>
                  How often?
                </Text>
                <View style={{ flexDirection: "row", gap: space.xs }}>
                  <Chip
                    label="Every day"
                    selected={freq === "daily"}
                    onPress={() => setFreq("daily")}
                  />
                  <Chip
                    label="Once"
                    selected={freq === "once"}
                    onPress={() => setFreq("once")}
                  />
                </View>
              </View>

              <TimeField label="Time" value={time} onChange={setTime} />

              {freq === "once" ? (
                <DateField
                  label="Date"
                  value={date}
                  onChange={setDate}
                  minDate={new Date()}
                  placeholder="Pick a date"
                />
              ) : null}

              <Button
                label={reminder ? "Save new reminder" : "Set reminder"}
                onPress={onSaveReminderPress}
                loading={busy}
              />
              {reminder ? (
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={cancelEditing}
                />
              ) : null}
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
  reminderSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
