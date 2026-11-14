import { findPartnerMembership } from "./membership.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const recordId = /^rec[A-Za-z0-9]{14}$/;
const referralFields = ["Company", "Partner", "Contact", "Email", "Country", "Status", "Created", "Last modified", "Expected monthly volume", "Currencies", "Other currency", "Notes"];

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

function timestamp(value) {
  if (typeof value !== "string" || !value.includes("T") || !Number.isFinite(Date.parse(value))) return "";
  return new Date(value).toISOString();
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
    volume: text("Expected monthly volume"),
    cur: Array.isArray(fields.Currencies) ? fields.Currencies.filter((value) => typeof value === "string") : [],
    otherCur: text("Other currency"),
    notes: text("Notes"),
    status: text("Status") || "Unknown",
    created,
    createdAt: timestamp(fields.Created) || timestamp(record.createdTime),
    modifiedAt: timestamp(fields["Last modified"]),
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

const volumes = ["Under CAD 50,000", "CAD 50,000 to 250,000", "CAD 250,000 to 1,000,000", "Over CAD 1,000,000"];
const currencies = ["CAD", "USD", "EUR", "GBP", "AUD", "MXN", "Other"];

function validateReferral(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  // Explicitly allow only form fields. The caller cannot assign a partner or status.
  const allowed = new Set(["company", "contact", "email", "country", "volume", "cur", "otherCur", "notes"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;
  const result = {};
  for (const [key, max] of [["company", 200], ["contact", 200], ["email", 254], ["country", 60], ["volume", 60], ["otherCur", 60], ["notes", 5000]]) {
    const value = input[key] ?? "";
    if (typeof value !== "string" || value.length > max) return null;
    result[key] = value.trim();
  }
  result.email = result.email.toLowerCase();
  if (!result.company || !result.contact || !/^\S+@\S+\.\S+$/.test(result.email) ||
      !["Canada", "United States"].includes(result.country) || !volumes.includes(result.volume)) return null;
  if (!Array.isArray(input.cur) || input.cur.length < 1 || input.cur.length > currencies.length ||
      input.cur.some((value) => !currencies.includes(value)) || new Set(input.cur).size !== input.cur.length) return null;
  result.cur = input.cur;
  if (result.cur.includes("Other") && !result.otherCur) return null;
  if (!result.cur.includes("Other")) result.otherCur = "";
  return result;
}

async function writeReferral({ env, partnerId, input, fetchImpl }) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_REFERRALS_TABLE_ID)}`;
  const fields = {
    Company: input.company, Contact: input.contact, Email: input.email, Country: input.country,
    "Expected monthly volume": input.volume, Currencies: input.cur,
    "Other currency": input.otherCur, Notes: input.notes, Partner: [partnerId], Status: "Invited",
  };
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ records: [{ fields }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Airtable write failed");
  const body = await response.json();
  const record = body.records?.[0];
  if (!recordId.test(record?.id || "") || !record.fields ||
      record.fields.Partner?.length !== 1 || record.fields.Partner[0] !== partnerId) {
    throw new Error("Invalid Airtable result");
  }
  return normalizeReferral(record);
}

export function createReferralsHandler({ env, fetchImpl = fetch }) {
  return async function handler(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed." }, 405);

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
      let input;
      if (request.method === "POST") {
        const raw = await request.text();
        if (raw.length > 16000) return json({ error: "Client details are too long." }, 413);
        try { input = validateReferral(JSON.parse(raw)); } catch { /* Invalid JSON is a validation error. */ }
        if (!input) return json({ error: "Please check all required client details and field limits." }, 400);
      }
      const referrals = await readReferrals({ env, partnerId, fetchImpl });
      if (input) {
        if (referrals.some((row) => row.company.trim().toLowerCase() === input.company.toLowerCase())) {
          return json({ error: "You have already referred this company." }, 409);
        }
        const referral = await writeReferral({ env, partnerId, input, fetchImpl });
        return json({ referral }, 201);
      }
      return json({ referrals });
    } catch {
      // Do not expose upstream responses, contact details or credentials in errors.
      return json({ error: request.method === "POST" ? "Unable to confirm the client was saved. Check Referrals before trying again." : "Unable to load referrals. Please try again." }, 502);
    }
  };
}
