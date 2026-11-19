import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";
import { AppError, AuthCancelledError } from "./errors";

WebBrowser.maybeCompleteAuthSession();

const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, " "));

// Reads ?query and #fragment parameters from the callback URL.
function parseParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf("#");
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const qIndex = beforeHash.indexOf("?");
  const query = qIndex >= 0 ? beforeHash.slice(qIndex + 1) : "";

  const out: Record<string, string> = {};
  for (const chunk of [query, hash].join("&").split("&")) {
    if (!chunk) continue;
    const eq = chunk.indexOf("=");
    const key = decode(eq < 0 ? chunk : chunk.slice(0, eq));
    out[key] = eq < 0 ? "" : decode(chunk.slice(eq + 1));
  }
  return out;
}

export async function signInWithGoogle(): Promise<void> {
  // Must match an entry in Supabase > Authentication > URL Configuration > Redirect URLs.
  const redirectTo = Linking.createURL("auth-callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: "openid email profile", // basic identity only
    },
  });
  if (error || !data?.url)
    throw new AppError("Could not start Google sign-in. Try again.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss")
    throw new AuthCancelledError();
  if (result.type !== "success")
    throw new AppError("Google sign-in did not finish. Try again.");

  const params = parseParams(result.url);
  if (params.error) throw new AppError("Google sign-in failed. Try again.");

  if (params.code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      params.code,
    );
    if (exchangeError)
      throw new AppError("That sign-in link expired. Please try again.");
    return;
  }
  throw new AppError("Sign-in did not complete. Please try again.");
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
