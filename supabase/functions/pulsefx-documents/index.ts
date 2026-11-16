import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { createDocumentsHandler } from "./service.mjs";
const env = Object.fromEntries(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_BRAND_ASSETS_TABLE_ID", "AIRTABLE_ONE_PAGERS_TABLE_ID"].map(key => [key, Deno.env.get(key)]));
const admin = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) }) } }) : null;
Deno.serve(createDocumentsHandler({ env, admin }));
