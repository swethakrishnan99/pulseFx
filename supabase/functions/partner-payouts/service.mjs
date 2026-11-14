import { bankFields, linkedBank, ownsBank } from "./banking.mjs";
import { adminPayouts } from "./admin.mjs";
import { findPartnerMembership } from "../_shared/partner-membership.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const recordId = /^rec[A-Za-z0-9]{14}$/;
const payoutFields = ["Reference", "Partner", "Partner ID", "Client", "Amount", "Currency", "Status", "Paid at", "Notes", "Created at", "Bank Submission ID", "Cancelled at", "Cancellation reason", "Last edited at", "Show notes to partner", "Show cancellation reason to partner"];
const text = (fields, key) => typeof fields[key] === "string" ? fields[key] : "";
const timestamp = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const owns = (record, partnerId) => recordId.test(record.id || "") && record.fields?.["Partner ID"] === partnerId
  && Array.isArray(record.fields.Partner) && record.fields.Partner.length === 1 && record.fields.Partner[0] === partnerId;

export function createPayoutsHandler({ env, admin = null, fetchImpl = fetch }) {
  return async function handler(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
    const authorization = request.headers.get("Authorization");
    if (!/^Bearer\s+\S+$/i.test(authorization || "")) return json({ error: "Please sign in to view payouts." }, 401);
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    if (!env.SUPABASE_URL || !key || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) return json({ error: "Payouts are not configured. Please contact PulseFX." }, 503);
    try {
      const accessToken = authorization.replace(/^Bearer\s+/i, "");
      const auth = await fetchImpl(new URL("/auth/v1/user", env.SUPABASE_URL), {
        headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(10000),
      });
      if ([401, 403].includes(auth.status)) return json({ error: "Your session has expired. Please sign in again." }, 401);
      if (!auth.ok) throw new Error("Auth failed");
      const user = await auth.json();
      if (!user.id) return json({ error: "Please sign in to view payouts." }, 401);
      const view = new URL(request.url).searchParams.get("view") || "history";
      if (view === "admin") return adminPayouts({ request, env, user, admin, fetchImpl, json });
      if (view !== "history") return json({ error: "Invalid payout request." }, 400);
      if (request.method !== "GET") return json({ error: "Partner payout history is read-only." }, 405);
      const partnerId = await findPartnerMembership({ projectUrl: env.SUPABASE_URL, publishableKey: key, accessToken, userId: user.id,
        fetchImpl: (url, options) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) }) });
      if (!recordId.test(partnerId || "")) return json({ error: "Your account is not linked to an active partner. Please contact PulseFX." }, 403);
      const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
      const table = env.AIRTABLE_PAYOUTS_TABLE_ID || "Payouts_api";
      const records = [], seen = new Set(); let offset;
      do {
        const url = new URL(`${base}/${encodeURIComponent(table)}`);
        url.searchParams.set("filterByFormula", `{Partner ID}='${partnerId}'`);
        for (const field of payoutFields) url.searchParams.append("fields[]", field);
        url.searchParams.set("pageSize", "100");
        if (offset) url.searchParams.set("offset", offset);
        const response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Payouts unavailable");
        const body = await response.json();
        if (!Array.isArray(body.records)) throw new Error("Invalid payouts");
        records.push(...body.records.filter((record) => owns(record, partnerId)));
        offset = body.offset;
        if (offset && (typeof offset !== "string" || seen.has(offset))) throw new Error("Invalid pagination");
        if (offset) seen.add(offset);
      } while (offset);
      // Resolve historical submissions only for this member's partner; never substitute the current account.
      const banks = [];
      if (records.some(row => text(row.fields, "Bank Submission ID"))) {
        let bankOffset; const bankSeen = new Set();
        do {
          const url = new URL(`${base}/${encodeURIComponent(env.AIRTABLE_BANKING_TABLE_ID || "Banking_details_api")}`);
          url.searchParams.set("filterByFormula", `{Partner ID}='${partnerId}'`);
          for (const field of bankFields) url.searchParams.append("fields[]", field);
          if (bankOffset) url.searchParams.set("offset", bankOffset);
          const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` }, signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error("Payout accounts unavailable");
          const body = await response.json();
          if (!Array.isArray(body.records)) throw new Error("Invalid payout accounts");
          banks.push(...body.records.filter(row => ownsBank(row, partnerId)));
          bankOffset = body.offset;
          if (bankOffset && (typeof bankOffset !== "string" || bankSeen.has(bankOffset))) throw new Error("Invalid account pagination");
          if (bankOffset) bankSeen.add(bankOffset);
        } while (bankOffset);
      }
      const payouts = records.map(({ id, fields: f, createdTime }) => ({ id, ref: text(f, "Reference"), client: text(f, "Client"),
        amount: typeof f.Amount === "number" && Number.isFinite(f.Amount) ? f.Amount : null,
        currency: text(f, "Currency") || "CAD", status: text(f, "Status") || "Pending", date: text(f, "Paid at"), createdAt: timestamp(f["Created at"]) || timestamp(createdTime), ...(f["Show notes to partner"] === true ? { notes: text(f, "Notes") } : {}), submissionId: text(f, "Bank Submission ID"), bank: linkedBank(banks, partnerId, text(f, "Bank Submission ID")), cancelledAt: timestamp(f["Cancelled at"]), ...(f["Show cancellation reason to partner"] === true ? { cancellationReason: text(f, "Cancellation reason") } : {}), lastEditedAt: timestamp(f["Last edited at"]) }))
        .sort((a, b) => b.date.localeCompare(a.date));
      return json({ payouts });
    } catch {
      return json({ error: request.method === "POST" ? "Unable to confirm the payout was saved. Refresh before trying again." : "Unable to load payouts. Please try again." }, 502);
    }
  };
}
