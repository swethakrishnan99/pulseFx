import { loadOnePagers } from "./one-pagers.mjs";
import { findPartnerMembership } from "../_shared/partner-membership.mjs";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
export function createOnePagersHandler({ env, fetchImpl = fetch }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const authorization = request.headers.get("Authorization");
    if (!/^Bearer\s+\S+$/i.test(authorization || "")) return json({ error: "Please sign in." }, 401);
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    if (!env.SUPABASE_URL || !key || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_ONE_PAGERS_TABLE_ID) return json({ error: "PulseFX one-pagers are not configured." }, 503);
    const call = (url, options = {}) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(20000) });
    try {
      const auth = await call(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
      if ([401, 403].includes(auth.status)) return json({ error: "Please sign in again." }, 401);
      if (!auth.ok) throw new Error("Auth unavailable");
      const user = await auth.json();
      if (!user.id) return json({ error: "Please sign in again." }, 401);
      const partner = await findPartnerMembership({ projectUrl: env.SUPABASE_URL, publishableKey: key, accessToken: authorization.replace(/^Bearer\s+/i, ""), userId: user.id, fetchImpl: call });
      if (!/^rec[A-Za-z0-9]{14}$/.test(partner || "")) return json({ error: "An active partner account is required." }, 403);
      return json({ onePagers: await loadOnePagers({ env, call }) });
    } catch {
      return json({ error: "PulseFX one-pagers are currently unavailable. Please try again later." }, 503);
    }
  };
}
