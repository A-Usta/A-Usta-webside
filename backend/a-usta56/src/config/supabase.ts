import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";
import { privilegedFetch } from "./privileged-fetch.js";

export const supabase = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    global: { fetch: privilegedFetch(env.supabaseServiceRoleKey) },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
