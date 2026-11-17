import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createReferralFormHandler } from "./service.mjs";
const env = Object.fromEntries(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_PARTNERS_TABLE_ID", "AIRTABLE_REFERRALS_TABLE_ID", "AIRTABLE_REFERRAL_FORM_TABLE_ID", "PORTAL_URL", "PARTNER_REFERRAL_LINK_SECRET"].map(key => [key, Deno.env.get(key)]));
const admin = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) },
}) : null;
Deno.serve(createReferralFormHandler({ env, admin }));
