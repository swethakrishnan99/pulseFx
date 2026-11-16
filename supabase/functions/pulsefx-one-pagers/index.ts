import { createOnePagersHandler } from "./service.mjs";
const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_ONE_PAGERS_TABLE_ID"];
Deno.serve(createOnePagersHandler({ env: Object.fromEntries(keys.map(key => [key, Deno.env.get(key)])) }));
