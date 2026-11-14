import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createPayoutsHandler } from "./service.mjs";

const env = Object.fromEntries([
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_PAYOUTS_TABLE_ID", "AIRTABLE_PARTNERS_TABLE_ID",
  "AIRTABLE_REFERRALS_TABLE_ID", "AIRTABLE_BANKING_TABLE_ID",
].map((key) => [key, Deno.env.get(key)]));
const admin = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) },
  }) : null;
Deno.serve(createPayoutsHandler({ env, admin }));
