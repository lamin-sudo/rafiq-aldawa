// App-level parameters. The app talks to Supabase directly, so this only
// exposes the project coordinates and no token (Supabase sessions are managed
// by supabase-js in src/lib/supabase.js).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dsldnbmbedeavrdtrvuq.supabase.co";
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "dsldnbmbedeavrdtrvuq";

export const appParams = {
  appId: PROJECT_ID,
  projectId: PROJECT_ID,
  token: null,
  functionsVersion: null,
  appBaseUrl: SUPABASE_URL,
};

export default appParams;
