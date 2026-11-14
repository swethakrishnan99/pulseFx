import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createBankingHandler } from "./service.mjs";

const env = Object.fromEntries([
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID",
  "AIRTABLE_BANKING_TABLE_ID", "AIRTABLE_PAYOUTS_TABLE_ID", "AIRTABLE_PARTNERS_TABLE_ID", "SUPABASE_SERVICE_ROLE_KEY",
].map((key) => [key, Deno.env.get(key)]));
const admin = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;
Deno.serve(createBankingHandler({ env, admin }));
