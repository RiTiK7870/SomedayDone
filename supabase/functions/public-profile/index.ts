// Public dream page data at /functions/v1/public-profile/<slug>.
// Returns JSON only. Supabase rewrites HTML from functions on the default domain to plain text,
// so the page itself is a static file (public-page/index.html) that reads this JSON.
// Shares only titles, categories, status, and step counts. Descriptions and step text stay private.
// Deploy with: supabase functions deploy public-profile --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";

const SLUG = /^[a-z0-9-]{3,30}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ error: "Not found" }, 404);

  const slug = (new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "").toLowerCase();
  if (!SLUG.test(slug)) return json({ error: "Not found" }, 404);

  // The service role bypasses row-level security, so the queries below are limited to public pages only.
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("public-profile: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json({ error: "Something went wrong", code: "MISSING_ENV" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error) {
    console.error("public-profile: profile query failed", error.code, error.message);
    return json({ error: "Something went wrong", code: error.code ?? "PROFILE_QUERY" }, 500);
  }
  if (!profile) return json({ error: "Not found" }, 404);

  const { data: goals, error: goalsError } = await admin
    .from("goals")
    .select("title, category, status, goal_steps(is_completed)")
    .eq("user_id", profile.id)
    .in("status", ["not_started", "in_progress", "completed"])
    .order("updated_at", { ascending: false })
    .limit(50);
  if (goalsError) {
    console.error("public-profile: goals query failed", goalsError.code, goalsError.message);
    return json({ error: "Something went wrong", code: goalsError.code ?? "GOALS_QUERY" }, 500);
  }

  const firstName = (profile.display_name ?? "").split(" ")[0] || "Someone";

  return json({
    name: firstName,
    goals: (goals ?? []).map((g: { title: string; category: string; status: string; goal_steps: { is_completed: boolean }[] }) => {
      const steps = g.goal_steps ?? [];
      return {
        title: g.title,
        category: g.category,
        status: g.status,
        totalSteps: steps.length,
        doneSteps: steps.filter((s) => s.is_completed).length,
      };
    }),
  });
});
