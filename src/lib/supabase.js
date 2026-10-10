import { createClient } from "@supabase/supabase-js";

// Rafiq Al-Dawa — Supabase project (eu-west-1)
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://dsldnbmbedeavrdtrvuq.supabase.co";

// Public (anon) key — safe to ship in the client. NEVER put the secret /
// service_role key here: those live only server-side (edge functions).
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzbGRuYm1iZWRlYXZyZHRydnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTM1OTEsImV4cCI6MjEwNzEyOTU5MX0.vH6mfeJIowZYmWfmchHDwtx-_XZ9xBFf4fdguPeBZF8";

export const isNativePlatform = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // On native the WebView origin is https://localhost and OAuth comes back
    // through a custom-scheme deep link, so URL detection must stay off.
    detectSessionInUrl: !isNativePlatform(),
    flowType: "pkce",
    storageKey: "rafiq-aldawa-auth",
  },
});

export default supabase;
