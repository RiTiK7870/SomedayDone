// Awards badges from the signed-in user's real data, then returns every badge they have earned.
// Only this function (service role) writes badges. Earned badges are never removed.
// Deploy with: supabase functions deploy award-badges
import { createClient } from "npm:@supabase/supabase-js@2";

type StepRow = { is_completed: boolean; completed_at: string | null };
type GoalRow = { status: string; goal_steps: StepRow[] };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Day number in the user's local calendar. tzOffsetMinutes is JavaScript's getTimezoneOffset().
function dayNumber(iso: string, tzOffsetMinutes: number): number {
  const local = new Date(iso).getTime() - tzOffsetMinutes * 60_000;
  return Math.floor(local / 86_400_000);
}

// The longest run of consecutive days.
function longestRun(days: number[]): number {
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Not signed in" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = (Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

  // Identify the caller from their own token, never from the request body.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);
  const userId = userData.user.id;

  let tz = 0;
  try {
    const body = await req.json();
    const v = Number(body?.tzOffsetMinutes);
    if (Number.isFinite(v) && Math.abs(v) <= 840) tz = v;
  } catch {
    // No body: keep UTC.
  }

  // Read through the user's own session, so row-level security limits this to their goals.
  const { data: goals, error: goalsError } = await userClient
    .from("goals")
    .select("status, goal_steps(is_completed, completed_at)")
    .eq("user_id", userId);
  if (goalsError) return json({ error: "Could not read your goals" }, 500);

  const list = (goals ?? []) as GoalRow[];
  const allSteps = list.flatMap((g) => g.goal_steps ?? []);
  const doneSteps = allSteps.filter((s) => s.is_completed).length;
  const finished = list.filter((g) => g.status === "completed").length;
  const days = allSteps
    .filter((s) => s.is_completed && s.completed_at)
    .map((s) => dayNumber(s.completed_at as string, tz));
  const run = longestRun(days);

  const met: string[] = [];
  if (doneSteps >= 1) met.push("first-step");
  if (doneSteps >= 10) met.push("ten-steps");
  if (doneSteps >= 50) met.push("fifty-steps");
  if (finished >= 1) met.push("finisher");
  if (list.length >= 5) met.push("dreamer");
  if (run >= 3) met.push("streak-3");
  if (run >= 7) met.push("streak-7");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (met.length > 0) {
    const { error } = await admin.from("user_badges").upsert(
      met.map((badge_id) => ({ user_id: userId, badge_id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true },
    );
    if (error) return json({ error: "Could not save badges" }, 500);
  }

  const { data: earned, error: readError } = await admin
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);
  if (readError) return json({ error: "Could not read badges" }, 500);

  return json({ earned: (earned ?? []).map((r) => r.badge_id as string) });
});
