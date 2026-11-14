import { createReferralsHandler } from "./service.mjs";

Deno.serve(createReferralsHandler({
  env: {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
    SUPABASE_PUBLISHABLE_KEY: Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    AIRTABLE_TOKEN: Deno.env.get("AIRTABLE_TOKEN"),
    AIRTABLE_BASE_ID: Deno.env.get("AIRTABLE_BASE_ID"),
    AIRTABLE_REFERRALS_TABLE_ID: Deno.env.get("AIRTABLE_REFERRALS_TABLE_ID"),
    AIRTABLE_PARTNERS_TABLE_ID: Deno.env.get("AIRTABLE_PARTNERS_TABLE_ID"),
  },
}));
