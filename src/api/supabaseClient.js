/**
 * supabaseClient.js — the application data/auth/API client layer.
 *
 * The UI was originally written against a third-party SDK's shape; this module keeps that same call shape `api.entities.X.filter(...)`,
 * `api.auth.me()`, `api.functions.invoke(...)` and
 * `api.integrations.Core.*`. Instead of rewriting ~110 call sites, this
 * module re-implements that exact surface on top of Supabase (Postgres +
 * PostgREST + Storage + Edge Functions + GoTrue auth).
 *
 * Field mapping: the legacy field `created_by_id` is the DB column
 * `user_id`; on read we expose it back as `created_by_id` so existing code
 * keeps working.
 */
import { supabase, isNativePlatform } from "@/lib/supabase";
import { APP_URL_SCHEME, NATIVE_AUTH_REDIRECT, openOAuthUrl } from "@/lib/nativeAuth";

const ENTITY_TABLE = {
  Medication: "medications",
  CareRecipient: "care_recipients",
  DoseLog: "dose_logs",
  FamilyMember: "family_members",
  EmergencyInfo: "emergency_info",
  VitalSigns: "vital_signs",
  NotificationSettings: "notification_settings",
  NotificationLog: "notification_logs",
  Notification: "notifications",
  PillScan: "pill_scans",
  ScanHistory: "scan_history",
  ChatMessage: "chat_messages",
  AuditLog: "audit_logs",
  ActivityFeed: "activity_feed",
  FeatureRequest: "feature_requests",
  User: "profiles",
};

const OWNER_TABLES = new Set(["profiles"]);

// ---------------------------------------------------------------- helpers ---

const toDb = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const out = { ...obj };
  if ("created_by_id" in out) {
    if (!("user_id" in out)) out.user_id = out.created_by_id;
    delete out.created_by_id;
  }
  delete out.created_by;
  delete out.created_date;
  delete out.updated_date;
  delete out.id;
  return out;
};

const fromDb = (row) => {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  if (out.user_id !== undefined && out.created_by_id === undefined) {
    out.created_by_id = out.user_id;
  }
  return out;
};

const asArray = (rows) => {
  const arr = Array.isArray(rows) ? rows.map(fromDb) : [];
  // The previous SDK's filter() resolved to { items: [...] } in some call sites and to a
  // plain array in others — attach `items` so both shapes work.
  arr.items = arr;
  return arr;
};

const parseSort = (sort) => {
  if (!sort || typeof sort !== "string") return { column: "created_date", ascending: false };
  const ascending = !sort.startsWith("-");
  const column = ascending ? sort : sort.slice(1);
  return { column: column || "created_date", ascending };
};

const escapeLike = (s) => String(s).replace(/[%,()]/g, (m) => "\\" + m);

const applyQuery = (q, query) => {
  if (!query || typeof query !== "object") return q;
  for (const [key, value] of Object.entries(query)) {
    if (key === "$or" && Array.isArray(value)) {
      const parts = [];
      for (const clause of value) {
        for (const [ck, cv] of Object.entries(clause || {})) {
          const col = ck === "created_by_id" ? "user_id" : ck;
          if (cv && typeof cv === "object" && "$regex" in cv) {
            parts.push(`${col}.ilike.%${escapeLike(cv.$regex)}%`);
          } else {
            parts.push(`${col}.eq.${cv}`);
          }
        }
      }
      if (parts.length) q = q.or(parts.join(","));
      continue;
    }
    const col = key === "created_by_id" ? "user_id" : key;
    if (value === null) {
      q = q.is(col, null);
    } else if (value && typeof value === "object") {
      if ("$regex" in value) q = q.ilike(col, `%${escapeLike(value.$regex)}%`);
      else if ("$in" in value) q = q.in(col, value.$in);
      else if ("$ne" in value) q = q.neq(col, value.$ne);
      else if ("$gt" in value) q = q.gt(col, value.$gt);
      else if ("$lt" in value) q = q.lt(col, value.$lt);
    } else {
      q = q.eq(col, value);
    }
  }
  return q;
};

const throwIf = (error) => {
  if (error) {
    const e = new Error(error.message || "Supabase error");
    e.status = error.code;
    e.details = error;
    throw e;
  }
};

function makeEntity(name) {
  const table = ENTITY_TABLE[name] || name.toLowerCase();
  const isProfile = OWNER_TABLES.has(table);

  const build = (query, sort, limit) => {
    let q = supabase.from(table).select("*");
    q = applyQuery(q, query);
    const s = parseSort(sort);
    q = q.order(s.column, { ascending: s.ascending });
    if (limit) q = q.limit(limit);
    return q;
  };

  const normalizeSortLimit = (a, b) => {
    if (a && typeof a === "object") return { sort: a.sort, limit: a.limit ?? b };
    return { sort: a, limit: b };
  };

  return {
    async list(sort, limit) {
      const { sort: s, limit: l } = normalizeSortLimit(sort, limit);
      const { data, error } = await build({}, s, l);
      throwIf(error);
      return asArray(data);
    },

    async filter(query, sortOrOptions, limit) {
      const { sort, limit: l } = normalizeSortLimit(sortOrOptions, limit);
      const { data, error } = await build(query, sort, l);
      throwIf(error);
      return asArray(data);
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      throwIf(error);
      return fromDb(data);
    },

    async create(payload) {
      const row = toDb(payload);
      const { data, error } = await supabase.from(table).insert(row).select().maybeSingle();
      throwIf(error);
      return fromDb(data);
    },

    async update(id, payload) {
      const row = toDb(payload);
      const { data, error } = await supabase.from(table).update(row).eq("id", id).select().maybeSingle();
      throwIf(error);
      return fromDb(data);
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      throwIf(error);
      return { id };
    },

    async deleteMany(query) {
      let q = supabase.from(table).delete();
      // PostgREST requires a filter on DELETE; an empty query means "all rows
      // visible to me", which RLS already scopes to the current user.
      q = applyQuery(q, query && Object.keys(query).length ? query : { id: { $ne: null } });
      if (!query || !Object.keys(query).length) {
        q = supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      const { error } = await q;
      throwIf(error);
      return { deleted: true };
    },
  };
}

// ------------------------------------------------------------------ auth ---

async function currentProfile() {
  const { data } = await supabase.auth.getUser();
  const authUser = data?.user;
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  return {
    id: authUser.id,
    email: authUser.email,
    full_name:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      (authUser.email ? authUser.email.split("@")[0] : ""),
    role: profile?.role || "user",
    language: profile?.language || "ar",
    app_lock_enabled: profile?.app_lock_enabled ?? false,
    app_lock_pin_hash: profile?.app_lock_pin_hash ?? "",
    app_lock_pin_salt: profile?.app_lock_pin_salt ?? "",
    app_lock_timeout_minutes: profile?.app_lock_timeout_minutes ?? 5,
    biometric_enabled: profile?.biometric_enabled ?? false,
    ...(profile || {}),
    id: authUser.id,
    email: authUser.email,
  };
}

const auth = {
  async me() {
    const profile = await currentProfile();
    if (!profile) {
      const e = new Error("Not authenticated");
      e.status = 401;
      throw e;
    }
    return profile;
  },

  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  },

  async logout(url) {
    await supabase.auth.signOut();
    if (url) {
      window.location.replace("/login");
    }
  },

  redirectToLogin() {
    window.location.href = "/login";
  },

  async updateMe(patch) {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) throw new Error("Not authenticated");
    const { error } = await supabase
      .from("profiles")
      .update({ ...patch, updated_date: new Date().toISOString() })
      .eq("id", data.user.id);
    throwIf(error);
    return { ...(await currentProfile()) };
  },

  async setToken(accessToken, refreshToken) {
    // verifyOtp / exchangeCodeForSession already install a session; only set one
    // explicitly when the caller really has a token pair to hand over.
    const { data } = await supabase.auth.getSession();
    if (data?.session) return true;
    if (!accessToken) throw new Error("Missing access token");
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || "",
    });
    if (error) throw error;
    return true;
  },

  async loginWithProvider(provider, redirectTo) {
    const target = isNativePlatform() ? NATIVE_AUTH_REDIRECT : redirectTo || window.location.origin + "/";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: target, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (data?.url) {
      await openOAuthUrl(data.url);
    }
    return data;
  },

  async register({ email, password }) {
    const emailRedirectTo = isNativePlatform()
      ? `${APP_URL_SCHEME}://auth/confirm`
      : window.location.origin + "/login";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    if (error) throw error;
    // No session => email confirmation is required by the project settings.
    return { ...data, requiresEmailConfirmation: !data?.session };
  },

  async verifyOtp({ email, otpCode, token, type }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode || token,
      type: type || "signup",
    });
    if (error) throw error;
    return { ...data, access_token: data?.session?.access_token };
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
    return true;
  },

  async resetPasswordRequest(email) {
    const redirectTo = isNativePlatform()
      ? `${APP_URL_SCHEME}://auth/reset-password`
      : window.location.origin + "/reset-password";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return true;
  },

  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return true;
  },
};

// ------------------------------------------------------------- functions ---

const functions = {
  async invoke(name, payload = {}) {
    const { data, error } = await supabase.functions.invoke(name, { body: payload });
    if (error) {
      const e = new Error(error.message || `Function ${name} failed`);
      e.status = error.context?.status;
      throw e;
    }
    return { data };
  },
};

// --------------------------------------------------------- integrations ---

const IMAGE_BUCKET = "pills";

const Core = {
  async UploadPrivateFile({ file }) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id || "anonymous";
    const ext = (file?.name?.split(".").pop() || "jpg").toLowerCase();
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file?.type || "image/jpeg",
    });
    throwIf(error);
    return { file_uri: path };
  },

  async CreateFileSignedUrl({ file_uri }) {
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(file_uri, 60 * 60);
    throwIf(error);
    return { signed_url: data.signedUrl };
  },

  async SendEmail({ to, subject, body }) {
    // No transactional email provider is configured for this project.
    // Documented limitation: invitations are stored in `family_members` and are
    // claimed automatically when the invitee signs up with that email, but no
    // email is actually delivered. Wire a provider (Resend/SendGrid) into an
    // edge function and call it here to enable real delivery.
    console.warn("[SendEmail] email provider not configured — invite stored only", {
      to,
      subject,
      bodyLength: body?.length,
    });
    return { sent: false, reason: "email_provider_not_configured" };
  },
};

const app = {
  async getPublicSettings() {
    return { id: "rafiq-aldawa", public_settings: {} };
  },
};

export const api = {
  entities: new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop !== "string") return undefined;
        if (!_t[prop]) _t[prop] = makeEntity(prop);
        return _t[prop];
      },
    },
  ),
  auth,
  functions,
  integrations: { Core },
  app,
};

export default api;
