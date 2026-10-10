// Native (Capacitor) auth glue for Supabase.
//
// Why this exists: inside the Android WebView the app origin is
// https://localhost, which no system browser can reach, so the OAuth /
// email-confirmation round-trip has to come back through a custom-scheme deep
// link instead:
//   com.rafiqaldawa.app://auth/return?code=...      (OAuth, PKCE)
//   com.rafiqaldawa.app://auth/confirm?...          (signup confirmation)
//   com.rafiqaldawa.app://auth/reset-password?...   (password recovery)
//
// The scheme is declared as an intent-filter in AndroidManifest.xml and each
// URL must be listed under Supabase -> Authentication -> URL Configuration ->
// Redirect URLs.

import { supabase } from "@/lib/supabase";

export const APP_URL_SCHEME = "com.rafiqaldawa.app";
export const NATIVE_AUTH_REDIRECT = `${APP_URL_SCHEME}://auth/return`;
export const NATIVE_CONFIRM_REDIRECT = `${APP_URL_SCHEME}://auth/confirm`;
export const NATIVE_RESET_REDIRECT = `${APP_URL_SCHEME}://auth/reset-password`;

export const isNative = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

// --- auth diagnostics channel -----------------------------------------------
// A failed deep-link completion used to be swallowed (console.error + return
// false), which is exactly the "browser opens, blinks, app comes back, nothing
// happened" symptom. Subscribers (the login screen) now get a real message.
export const AUTH_ERROR_EVENT = "rafiq-auth-error";
function emitAuthError(message, detail) {
  console.error("[rafiq-auth]", message, detail ?? "");
  try {
    window.dispatchEvent(
      new CustomEvent(AUTH_ERROR_EVENT, { detail: { message, detail: detail ? String(detail) : "" } })
    );
  } catch {
    /* non-DOM environment */
  }
}

// `appUrlOpen` and `getLaunchUrl()` can both carry the SAME deep link (warm
// start from the Custom Tab), and a PKCE `code` is single-use: exchanging it
// twice fails with "invalid grant" on the second call. Track what we already
// consumed so a duplicate cannot race the valid exchange.
const consumedCodes = new Set();

/** Open an OAuth URL: in-app browser on native, full redirect on web. */
export async function openOAuthUrl(url) {
  if (isNative()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, windowName: "_system" });
    return;
  }
  window.location.href = url;
}

/**
 * Complete a Supabase auth round-trip from a deep link. Supabase (PKCE flow)
 * delivers either a `code` query param or an `access_token`/`refresh_token`
 * fragment depending on the flow; both are handled.
 */
export async function handleDeepLink(url) {
  if (!url || !url.startsWith(APP_URL_SCHEME)) return false;
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  const errorCode = parsed.searchParams.get("error_code") || parsed.searchParams.get("error");
  const errorDescription = parsed.searchParams.get("error_description") || errorCode;
  if (errorDescription) {
    emitAuthError("deep link returned an error", errorDescription);
    return false;
  }
  const hash = new URLSearchParams((parsed.hash || "").replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const type = parsed.searchParams.get("type") || hash.get("type");

  try {
    if (code) {
      if (consumedCodes.has(code)) {
        console.warn("[rafiq-auth] ignoring already-consumed code");
        return false;
      }
      consumedCodes.add(code);
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    } else {
      emitAuthError("deep link carried no code or token", url);
      return false;
    }

    // Confirm the session really landed before navigating, so a silent failure
    // cannot masquerade as success.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      emitAuthError("session missing after exchange");
      return false;
    }

    // Dismiss the Custom Tab first, then navigate ONCE to the app root. A
    // follow-up reload() is a trap: it re-loads the document that is still
    // current (/login) and the user ends up stranded on the login screen with a
    // perfectly valid session in storage.
    if (isNative()) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.close();
      } catch {
        /* tab already gone */
      }
    }
    const target = type === "recovery" ? "/reset-password" : "/";
    window.location.replace(target);
    return true;
  } catch (e) {
    emitAuthError("deep-link completion failed", e?.message || e);
    return false;
  }
}

/**
 * Listen for the auth deep link (warm start) and also check the URL that
 * launched a cold start -- `appUrlOpen` can fire before React registers the
 * listener, which would otherwise lose the link.
 */
export async function initNativeAuth() {
  if (!isNative()) return () => {};
  const { App: CapApp } = await import("@capacitor/app");
  const handle = await CapApp.addListener("appUrlOpen", ({ url }) => {
    handleDeepLink(url);
  });
  try {
    const launch = await CapApp.getLaunchUrl();
    if (launch?.url) await handleDeepLink(launch.url);
  } catch {
    /* no launch URL */
  }
  return () => handle.remove();
}

/** Google sign-in for native builds (Supabase OAuth + PKCE). */
export async function loginWithGoogleNative() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) {
    emitAuthError("Google sign-in returned no authorize URL", error);
    return data;
  }
  await openOAuthUrl(data.url);
  return data;
}
