// Sends a push notification to the partner who was nudged.
// Called by the app right after a nudge is saved. Only the sender can trigger it,
// and only for a nudge that is recent and still belongs to an accepted partnership.
// Deploy with: supabase functions deploy notify-nudge
import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_AGE_MS = 5 * 60_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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
  const senderId = userData.user.id;

  let nudgeId = "";
  try {
    const body = await req.json();
    nudgeId = typeof body?.nudgeId === "string" ? body.nudgeId : "";
  } catch {
    // Missing body is handled below.
  }
  if (!/^[0-9a-f-]{36}$/i.test(nudgeId)) return json({ error: "Invalid request" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: nudge, error: nudgeError } = await admin
    .from("partner_nudges")
    .select("id, goal_id, from_id, to_id, created_at")
    .eq("id", nudgeId)
    .maybeSingle();
  if (nudgeError) return json({ error: "Could not read the nudge" }, 500);
  if (!nudge || nudge.from_id !== senderId) return json({ error: "Not found" }, 404);
  if (Date.now() - new Date(nudge.created_at).getTime() > MAX_AGE_MS) {
    return json({ error: "This nudge is too old to send" }, 410);
  }

  // The partnership must still be accepted in either direction.
  const { data: links } = await admin
    .from("goal_partners")
    .select("owner_id, partner_id")
    .eq("goal_id", nudge.goal_id)
    .eq("status", "accepted");
  const allowed = (links ?? []).some(
    (l) =>
      (l.owner_id === senderId && l.partner_id === nudge.to_id) ||
      (l.partner_id === senderId && l.owner_id === nudge.to_id),
  );
  if (!allowed) return json({ error: "Not found" }, 404);

  const [goalRes, senderRes, tokenRes] = await Promise.all([
    admin.from("goals").select("title").eq("id", nudge.goal_id).maybeSingle(),
    admin.from("profiles").select("display_name").eq("id", senderId).maybeSingle(),
    admin.from("push_tokens").select("token").eq("user_id", nudge.to_id),
  ]);

  const tokens = (tokenRes.data ?? []).slice(0, 100);
  if (tokens.length === 0) return json({ sent: 0 });

  const firstName = (senderRes.data?.display_name ?? "").split(" ")[0] || "A partner";
  const goalTitle = goalRes.data?.title ?? "your goal";

  const messages = tokens.map((t) => ({
    to: t.token,
    title: "SomedayDone",
    body: `${firstName} nudged you about ${goalTitle}`,
    sound: "default",
    priority: "high",
    channelId: "nudges",
    data: { screen: "Partners", nudgeId: nudge.id },
  }));

  let res: Response;
  try {
    res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch {
    return json({ error: "Could not reach the push service" }, 502);
  }
  if (!res.ok) {
    console.error("notify-nudge: push service returned", res.status);
    return json({ error: "Push service unavailable" }, 502);
  }

  const result = (await res.json()) as {
    data?: { status: string; details?: { error?: string } }[];
  };
  const tickets = result.data ?? [];

  // Forget tokens for devices that uninstalled the app or revoked notifications.
  const dead = tokens
    .filter((_, i) => tickets[i]?.details?.error === "DeviceNotRegistered")
    .map((t) => t.token);
  if (dead.length > 0) {
    await admin.from("push_tokens").delete().in("token", dead);
  }

  return json({ sent: tickets.filter((t) => t.status === "ok").length });
});
