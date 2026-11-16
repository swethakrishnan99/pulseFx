import { findPartnerMembership } from "../_shared/partner-membership.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const recordId = /^rec[A-Za-z0-9]{14}$/;
export function createSupportHandler({ env, fetchImpl = fetch }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const authorization = request.headers.get("Authorization");
    if (!/^Bearer\s+\S+$/i.test(authorization || "")) return json({ error: "Please sign in to contact support." }, 401);
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    if (!env.SUPABASE_URL || !key || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_SUPPORT_TABLE_ID) return json({ error: "Support is not configured. Please contact PulseFX by email." }, 503);
    let writing = false;
    const call = (url, options = {}) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) });
    try {
      const auth = await call(new URL("/auth/v1/user", env.SUPABASE_URL), { headers: { apikey: key, Authorization: authorization } });
      if ([401, 403].includes(auth.status)) return json({ error: "Your session has expired. Please sign in again." }, 401);
      if (!auth.ok) throw new Error("Auth unavailable");
      const user = await auth.json();
      if (!user.id || !user.email) return json({ error: "Please sign in to contact support." }, 401);
      // RLS also checks enabled membership, the live session and current login email.
      const partnerId = await findPartnerMembership({ projectUrl: env.SUPABASE_URL, publishableKey: key, accessToken: authorization.replace(/^Bearer\s+/i, ""), userId: user.id, fetchImpl: call });
      if (!recordId.test(partnerId || "")) return json({ error: "An active partner account is required." }, 403);
      if (Number(request.headers.get("Content-Length")) > 24000) return json({ error: "Message is too long." }, 413);
      const raw = await request.text();
      if (raw.length > 24000) return json({ error: "Message is too long." }, 413);
      let input;
      try { input = JSON.parse(raw); } catch { return json({ error: "Invalid support request." }, 400); }
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !["subject", "message"].includes(key)) || typeof input.subject !== "string" || typeof input.message !== "string" || !input.subject.trim() || input.subject.length > 200 || !input.message.trim() || input.message.length > 10000) return json({ error: "Enter a subject (up to 200 characters) and message (up to 10,000 characters)." }, 400);
      const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
      const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
      const partnerResponse = await call(`${base}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || "Partners_api")}/${partnerId}`, { headers });
      if (!partnerResponse.ok) throw new Error("Partner unavailable");
      const partner = await partnerResponse.json();
      if (partner.id !== partnerId) throw new Error("Partner mismatch");
      const name = partner.fields?.Contact || partner.fields?.Name;
      if (typeof name !== "string" || !name.trim()) throw new Error("Partner name unavailable");
      // Never accept identity, status, source or response fields from the browser.
      const fields = { "Partner Airtable ID": partnerId, "Supabase user ID": user.id, "Client name": name.trim(), Email: user.email, Source: "Partner", Subject: input.subject.trim(), Message: input.message.trim(), Status: "Received" };
      writing = true;
      const response = await call(`${base}/${encodeURIComponent(env.AIRTABLE_SUPPORT_TABLE_ID)}`, { method: "POST", headers, body: JSON.stringify({ fields }) });
      if (!response.ok) throw new Error("Support write failed");
      const saved = await response.json();
      if (!recordId.test(saved.id || "") || typeof saved.fields?.["Support ID"] !== "string" || !saved.fields["Support ID"].trim()) throw new Error("Missing reference");
      return json({ request: { supportId: saved.fields["Support ID"], status: "Received" } }, 201);
    } catch {
      // A timeout can occur after Airtable accepted the write. Do not invite a duplicate retry.
      return json({ error: writing ? "We could not confirm whether your request was received. Please contact PulseFX by email before submitting it again." : "Unable to send your request. Please try again.", uncertain: writing }, 502);
    }
  };
}
