import { createBrandAssetsHandler } from "./service.mjs";
const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_BRAND_ASSETS_TABLE_ID"];
Deno.serve(createBrandAssetsHandler({ env: Object.fromEntries(keys.map(key => [key, Deno.env.get(key)])) }));
