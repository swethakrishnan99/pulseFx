import { findPartnerMembership } from "./membership.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const recordId = /^rec[A-Za-z0-9]{14}$/;
const referralFields = ["Company", "Partner", "Contact", "Email", "Country", "Status", "Created", "Last modified"];

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store" },
  });
}

function dateOnly(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "";
  return value.slice(0, 10);
}

function normalizeReferral(record) {
  const fields = record.fields;
  const text = (name) => typeof fields[name] === "string" ? fields[name] : "";
  const created = dateOnly(fields.Created) || dateOnly(record.createdTime);
  return {
    id: record.id,
    company: text("Company"),
    contact: text("Contact"),
    email: text("Email"),
    country: text("Country"),
    status: text("Status") || "Unknown",
    created,
    modified: dateOnly(fields["Last modified"]) || created,
  };
}

async function readReferrals({ env, partnerId, fetchImpl }) {
  const baseUrl = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
  const partnersTable = env.AIRTABLE_PARTNERS_TABLE_ID || "Partners";
  async function airtable(url) {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Airtable request failed");
    return response.json();
  }

  // Linked fields expose names in Airtable formulas. Use the partner's reciprocal
  // record links instead, so partners with identical names remain isolated.
  const partner = await airtable(`${baseUrl}/${encodeURIComponent(partnersTable)}/${partnerId}`);
  if (partner.id !== partnerId || !partner.fields) throw new Error("Invalid Airtable partner");
  const linkedIds = partner.fields.Referrals ?? [];
  if (!Array.isArray(linkedIds) || linkedIds.some((id) => !recordId.test(id))) {
    throw new Error("Invalid Airtable referral links");
  }

  const ids = [...new Set(linkedIds)];
  const referrals = new Map();
  // Keep URLs short and avoid fetching records belonging to other partners.
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const allowedIds = new Set(batch);
    let offset;
    const seenOffsets = new Set();
    do {
      const url = new URL(`${baseUrl}/${encodeURIComponent(env.AIRTABLE_REFERRALS_TABLE_ID)}`);
      url.searchParams.set("filterByFormula", `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`);
      url.searchParams.set("pageSize", "100");
      for (const field of referralFields) url.searchParams.append("fields[]", field);
      if (offset) url.searchParams.set("offset", offset);
      const page = await airtable(url);
      if (!Array.isArray(page.records)) throw new Error("Invalid Airtable referrals");
      for (const record of page.records) {
        // Check actual linked partner IDs again before returning any record.
        if (allowedIds.has(record.id) && Array.isArray(record.fields?.Partner) &&
            record.fields.Partner.length === 1 && record.fields.Partner[0] === partnerId) {
          referrals.set(record.id, normalizeReferral(record));
        }
      }
      offset = page.offset;
      if (offset && (typeof offset !== "string" || seenOffsets.has(offset))) {
        throw new Error("Invalid Airtable pagination");
      }
      if (offset) seenOffsets.add(offset);
    } while (offset);
  }
  return [...referrals.values()];
}

export function createReferralsHandler({ env, fetchImpl = fetch }) {
  return async function handler(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

    const authorization = request.headers.get("Authorization");
    if (!/^Bearer\s+\S+$/i.test(authorization || "")) {
      return json({ error: "Please sign in to view your referrals." }, 401);
    }
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    if (!env.SUPABASE_URL || !publishableKey) {
      return json({ error: "Partner access is not configured." }, 503);
    }

    try {
      // Validate with Auth, never trust a decoded JWT or a client-supplied partner ID.
      const authResponse = await fetchImpl(new URL("/auth/v1/user", env.SUPABASE_URL), {
        headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (authResponse.status === 401 || authResponse.status === 403) {
        return json({ error: "Your session has expired. Please sign in again." }, 401);
      }
      if (!authResponse.ok) throw new Error("Auth request failed");
      const user = await authResponse.json();
      if (!user.id) return json({ error: "Please sign in to view your referrals." }, 401);
      const partnerId = await findPartnerMembership({
        projectUrl: env.SUPABASE_URL, publishableKey, accessToken, userId: user.id,
        fetchImpl: (url, options) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) }),
      });
      if (!partnerId || !recordId.test(partnerId)) {
        return json({ error: "Your account is not linked to an Airtable partner. Please contact PulseFX." }, 403);
      }
      if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_REFERRALS_TABLE_ID) {
        return json({ error: "Referrals are not configured. Please contact PulseFX." }, 503);
      }
      const referrals = await readReferrals({ env, partnerId, fetchImpl });
      return json({ referrals });
    } catch {
      // Do not expose upstream responses, contact details or credentials in errors.
      return json({ error: "Unable to load referrals. Please try again." }, 502);
    }
  };
}
