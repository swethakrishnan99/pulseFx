import { createSupportHandler } from "../partner-support/service.mjs";
const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_SUPPORT_TABLE_ID"];
Deno.serve(createSupportHandler({ login: true, env: Object.fromEntries(keys.map(key => [key, Deno.env.get(key)])) }));
