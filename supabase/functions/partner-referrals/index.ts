import { createReferralsHandler } from "./service.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const projectUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = projectUrl && serviceKey ? createClient(projectUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) },
}) : null;

Deno.serve(createReferralsHandler({
  admin,
  env: {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
    SUPABASE_PUBLISHABLE_KEY: Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    AIRTABLE_TOKEN: Deno.env.get("AIRTABLE_TOKEN"),
    AIRTABLE_BASE_ID: Deno.env.get("AIRTABLE_BASE_ID"),
    AIRTABLE_REFERRAL_FORM_TABLE_ID: Deno.env.get("AIRTABLE_REFERRAL_FORM_TABLE_ID"),
    AIRTABLE_REFERRALS_TABLE_ID: Deno.env.get("AIRTABLE_REFERRALS_TABLE_ID"),
    AIRTABLE_PARTNERS_TABLE_ID: Deno.env.get("AIRTABLE_PARTNERS_TABLE_ID"),
  },
}));
