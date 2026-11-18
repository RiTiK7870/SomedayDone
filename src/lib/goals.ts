import { supabase } from "./supabase";
import type {
  Category,
  Goal,
  GoalStatus,
  Profile,
  Step,
  Reminder,
} from "../types";
import { calcProgress } from "./progress";
import { AppError } from "./errors";

// One query loads goals with their steps and reminder (avoids N+1 requests).
const GOAL_SELECT = "*, goal_steps(*), reminders(*)";
const PAGE_SIZE = 200;

export interface GoalInput {
  title: string;
  description: string;
  category: Category;
  targetDate: string; // YYYY-MM-DD or ''
}

// ---------- Reads ----------

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_SELECT)
    .order("updated_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []).map((goal) => ({
    ...goal,
    goal_steps: Array.isArray(goal.goal_steps) ? goal.goal_steps : [],
    reminders: Array.isArray(goal.reminders) ? goal.reminders : [],
  })) as Goal[];
}

export async function getGoal(id: string): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_SELECT)
    .eq("id", id)
    .single();
  if (error || !data) {
    throw new AppError("This goal could not be found.");
  }

  return {
    ...data,
    goal_steps: Array.isArray(data.goal_steps) ? data.goal_steps : [],
    reminders: Array.isArray(data.reminders) ? data.reminders : [],
  } as Goal;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

// Helper: create the profile if it is missing. The database trigger normally does this;
// the upsert with ignoreDuplicates makes it safe to call on every sign-in.
export async function ensureProfile(
  userId: string,
  displayName: string | null,
  avatarUrl: string | null,
) {
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, display_name: displayName, avatar_url: avatarUrl },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

// ---------- Goals ----------

export async function createGoal(
  userId: string,
  input: GoalInput,
): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      category: input.category,
      target_date: input.targetDate || null,
      status: "not_started",
    })
    .select(GOAL_SELECT)
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      category: input.category,
      target_date: input.targetDate || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setGoalStatus(
  id: string,
  status: GoalStatus,
): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function completeGoal(goalId: string): Promise<void> {
  const completedAt = new Date().toISOString();

  // Mark every step as completed.
  const { error: stepsError } = await supabase
    .from("goal_steps")
    .update({
      is_completed: true,
      completed_at: completedAt,
    })
    .eq("goal_id", goalId);

  if (stepsError) throw stepsError;

  // Mark the goal as completed.
  await setGoalStatus(goalId, "completed");
}

export async function resetGoalSteps(goalId: string): Promise<void> {
  const { error } = await supabase
    .from("goal_steps")
    .update({
      is_completed: false,
      completed_at: null,
    })
    .eq("goal_id", goalId);

  if (error) throw error;

  await setGoalStatus(goalId, "in_progress");
}

export async function deleteGoal(id: string): Promise<void> {
  // Steps and reminders are removed by ON DELETE CASCADE.
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Steps ----------

export async function addStep(goal: Goal, title: string): Promise<void> {
  const nextPosition =
    goal.goal_steps.reduce((max, s) => Math.max(max, s.position), -1) + 1;
  const { error } = await supabase
    .from("goal_steps")
    .insert({ goal_id: goal.id, title: title.trim(), position: nextPosition });
  if (error) throw error;
  if (goal.status === "not_started")
    await setGoalStatus(goal.id, "in_progress");
}

export async function setStepDone(
  goal: Goal,
  step: Step,
  done: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("goal_steps")
    .update({
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", step.id);
  if (error) throw error;
  if (done && goal.status === "not_started")
    await setGoalStatus(goal.id, "in_progress");
}

export async function renameStep(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from("goal_steps")
    .update({ title: title.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteStep(id: string): Promise<void> {
  const { error } = await supabase.from("goal_steps").delete().eq("id", id);
  if (error) throw error;
}

// Swaps positions of two neighbouring steps. Both updates are needed, so a failure
// on the second one is reported rather than silently leaving duplicate positions.
export async function swapSteps(a: Step, b: Step): Promise<void> {
  const r1 = await supabase
    .from("goal_steps")
    .update({ position: b.position })
    .eq("id", a.id);
  if (r1.error) throw r1.error;
  const r2 = await supabase
    .from("goal_steps")
    .update({ position: a.position })
    .eq("id", b.id);
  if (r2.error) throw r2.error;
}

// ---------- Reminders ----------

export async function saveReminder(
  goal: Goal,
  input: {
    userId: string;
    reminderTime: Date;
    frequency: "once" | "daily";
    notificationId: string;
    isEnabled: boolean;
  },
): Promise<void> {
  const { error } = await supabase.from("reminders").upsert(
    {
      goal_id: goal.id,
      user_id: input.userId,
      reminder_time: input.reminderTime.toISOString(),
      frequency: input.frequency,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      is_enabled: input.isEnabled,
      notification_id: input.notificationId,
    },
    { onConflict: "goal_id" },
  );
  if (error) throw error;
}

export async function setReminderEnabled(
  goalId: string,
  isEnabled: boolean,
  notificationId: string | null,
) {
  const { error } = await supabase
    .from("reminders")
    .update({ is_enabled: isEnabled, notification_id: notificationId })
    .eq("goal_id", goalId);
  if (error) throw error;
}

export async function deleteReminder(goalId: string): Promise<void> {
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("goal_id", goalId);
  if (error) throw error;
}

// ---------- Selectors and totals (pure, no network) ----------

export const ACTIVE_STATUSES: GoalStatus[] = ["not_started", "in_progress"];

export function isActive(goal: Goal): boolean {
  return ACTIVE_STATUSES.includes(goal.status);
}

export function sortedSteps(goal: Goal): Step[] {
  return [...goal.goal_steps].sort((a, b) => a.position - b.position);
}

export function progressFor(goal: Goal) {
  return calcProgress(goal.goal_steps);
}

const STATUS_ORDER: Record<GoalStatus, number> = {
  not_started: 0,
  in_progress: 0,
  completed: 1,
  archived: 2,
};

// Active goals first, then completed, then archived. Within each group, most recently updated first.
export function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function nextStepsFor(
  goals: Goal[],
  limit: number,
): { goal: Goal; step: Step }[] {
  const out: { goal: Goal; step: Step }[] = [];
  for (const goal of sortGoals(goals.filter(isActive))) {
    const step = sortedSteps(goal).find((s) => !s.is_completed);
    if (step) out.push({ goal, step });
    if (out.length >= limit) break;
  }
  return out;
}

export function computeTotals(goals: Goal[]) {
  return {
    goalsCreated: goals.length,
    goalsCompleted: goals.filter((g) => g.status === "completed").length,
    stepsCompleted: goals.reduce(
      (n, g) => n + g.goal_steps.filter((s) => s.is_completed).length,
      0,
    ),
  };
}

export type { Reminder };
