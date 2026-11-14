import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createPartnerSyncHandler } from "./service.mjs";

const env = Object.fromEntries([
  "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PARTNER_SYNC_SECRET", "AIRTABLE_TOKEN",
  "AIRTABLE_BASE_ID", "AIRTABLE_PARTNERS_TABLE_ID",
].map((key) => [key, Deno.env.get(key)]));
const admin = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) : null;
Deno.serve(createPartnerSyncHandler({ env, admin }));
