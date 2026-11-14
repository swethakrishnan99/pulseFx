import { bankingReview } from "./review.mjs";
import { findPartnerMembership } from "../referrals/membership.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const recordId = /^rec[A-Za-z0-9]{14}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bankFields = ["Submission ID", "Partner", "Partner ID", "Institution name", "Account holder", "Account number", "Institution code", "Transit number", "Currency", "Status", "Current account", "Review notes", "Submitted at", "Last modified"];
const payoutFields = ["Reference", "Partner", "Partner ID", "Client", "Amount", "Currency", "Status", "Paid at", "Notes"];
const text = (fields, key) => typeof fields[key] === "string" ? fields[key] : "";
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });

function bankSummary(record) {
  const f = record.fields;
  return {
    institutionCode: text(f, "Institution code"),
    transitNumber: text(f, "Transit number"),
    id: record.id, bank: text(f, "Institution name"), holder: text(f, "Account holder"),
    account: text(f, "Account number"), last4: text(f, "Account number").slice(-4), currency: text(f, "Currency"),
    status: text(f, "Status") || "Pending verification", current: f["Current account"] === true,
    reviewNotes: text(f, "Review notes"), submittedAt: text(f, "Submitted at") || record.createdTime || "",
    modifiedAt: text(f, "Last modified"),
  };
}
function validInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = ["submissionId", "bank", "holder", "account", "institutionCode", "transitNumber", "currency"];
  if (Object.keys(body).some((key) => !keys.includes(key))) return null;
  if (!uuid.test(body.submissionId || "")) return null;
  for (const key of ["bank", "holder", "account", "institutionCode", "transitNumber", "currency"]) {
    if (typeof body[key] !== "string") return null;
  }
  const input = Object.fromEntries(keys.map((key) => [key, body[key].trim()]));
  if (!input.bank || input.bank.length > 200 || !input.holder || input.holder.length > 200 ||
      !/^\d{4,34}$/.test(input.account) || !/^\d{3}$/.test(input.institutionCode) || !/^\d{5}$/.test(input.transitNumber) || input.currency !== "CAD") return null;
  return input;
}
function owns(record, partnerId) {
  return recordId.test(record.id || "") && record.fields?.["Partner ID"] === partnerId &&
    Array.isArray(record.fields.Partner) && record.fields.Partner.length === 1 && record.fields.Partner[0] === partnerId;
}

export function createBankingHandler({ env, admin = null, fetchImpl = fetch }) {
  return async function handler(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
    const authorization = request.headers.get("Authorization");
    if (!/^Bearer\s+\S+$/i.test(authorization || "")) return json({ error: "Please sign in to manage banking details." }, 401);
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    if (!env.SUPABASE_URL || !key || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) return json({ error: "Banking details are not configured. Please contact PulseFX." }, 503);
    try {
      const accessToken = authorization.replace(/^Bearer\s+/i, "");
      const auth = await fetchImpl(new URL("/auth/v1/user", env.SUPABASE_URL), {
        headers: { apikey: key, Authorization: authorization }, signal: AbortSignal.timeout(10000),
      });
      if ([401, 403].includes(auth.status)) return json({ error: "Your session has expired. Please sign in again." }, 401);
      if (!auth.ok) throw new Error("Auth failed");
      const user = await auth.json();
      if (!user.id) return json({ error: "Please sign in to manage banking details." }, 401);
      if (new URL(request.url).searchParams.get("view") === "review") {
        return bankingReview({ request, env, user, admin, fetchImpl, json });
      }
      const partnerId = await findPartnerMembership({ projectUrl: env.SUPABASE_URL, publishableKey: key, accessToken, userId: user.id,
        fetchImpl: (url, options) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) }) });
      if (!recordId.test(partnerId || "")) return json({ error: "Your account is not linked to an active partner. Please contact PulseFX." }, 403);
      const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
      const bankTable = env.AIRTABLE_BANKING_TABLE_ID || "Banking_details_api";
      const payoutTable = env.AIRTABLE_PAYOUTS_TABLE_ID || "Payouts_api";
      const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
      async function airtable(url, options = {}) {
        const response = await fetchImpl(url, { ...options, headers, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error("Airtable failed");
        return response.json();
      }
      async function list(table, fields) {
        const records = [];
        const seen = new Set();
        let offset;
        do {
          const url = new URL(`${base}/${encodeURIComponent(table)}`);
          url.searchParams.set("filterByFormula", `{Partner ID}='${partnerId}'`);
          for (const field of fields) url.searchParams.append("fields[]", field);
          url.searchParams.set("pageSize", "100");
          if (offset) url.searchParams.set("offset", offset);
          const body = await airtable(url);
          if (!Array.isArray(body.records)) throw new Error("Invalid records");
          records.push(...body.records.filter((record) => owns(record, partnerId)));
          offset = body.offset;
          if (offset && (typeof offset !== "string" || seen.has(offset))) throw new Error("Invalid pagination");
          if (offset) seen.add(offset);
        } while (offset);
        return records;
      }
      const view = new URL(request.url).searchParams.get("view") || "accounts";
      if (request.method === "GET" && view === "payouts") {
        const records = await list(payoutTable, payoutFields);
        const payouts = records.map(({ id, fields: f }) => ({ id, ref: text(f, "Reference"), client: text(f, "Client"),
          amount: typeof f.Amount === "number" && Number.isFinite(f.Amount) ? f.Amount : null,
          currency: text(f, "Currency") || "CAD", status: text(f, "Status") || "Pending", date: text(f, "Paid at"), notes: text(f, "Notes") }))
          .sort((a, b) => b.date.localeCompare(a.date));
        return json({ payouts });
      }
      if (view !== "accounts") return json({ error: "Invalid request." }, 400);
      let input;
      if (request.method === "POST") {
        const raw = await request.text();
        if (raw.length > 4000) return json({ error: "Banking details are too long." }, 413);
        try { input = validInput(JSON.parse(raw)); } catch { /* Reject malformed JSON. */ }
        if (!input) return json({ error: "Check all required fields. Enter a 3-digit institution code and a 5-digit transit number." }, 400);
      }
      const records = await list(bankTable, bankFields);
      if (input) {
        // Retries reuse the submission ID. Existing submissions, approvals and current flags are immutable here.
        const submissionId = `${partnerId}:${input.submissionId}`;
        const existing = records.find((record) => record.fields["Submission ID"] === submissionId);
        if (existing) {
          const f = existing.fields;
          if (f["Institution name"] !== input.bank || f["Account holder"] !== input.holder || f["Account number"] !== input.account ||
              f["Institution code"] !== input.institutionCode || f["Transit number"] !== input.transitNumber || f.Currency !== input.currency) {
            return json({ error: "This submission has already been saved. Refresh before submitting another change." }, 409);
          }
          return json({ account: bankSummary(existing) });
        }
        const fields = { "Submission ID": submissionId, Partner: [partnerId], "Partner ID": partnerId,
          "Institution name": input.bank, "Account holder": input.holder, "Account number": input.account,
          "Institution code": input.institutionCode, "Transit number": input.transitNumber, Currency: input.currency, Status: "Pending verification", "Current account": false };
        const body = await airtable(`${base}/${encodeURIComponent(bankTable)}`, { method: "POST", body: JSON.stringify({ records: [{ fields }] }) });
        const saved = body.records?.[0];
        if (!saved || !owns(saved, partnerId) || saved.fields["Submission ID"] !== submissionId || saved.fields.Status !== "Pending verification" || saved.fields["Current account"] === true ||
            saved.fields["Institution name"] !== input.bank || saved.fields["Account holder"] !== input.holder || saved.fields["Account number"] !== input.account ||
            saved.fields["Institution code"] !== input.institutionCode || saved.fields["Transit number"] !== input.transitNumber || saved.fields.Currency !== input.currency) throw new Error("Invalid saved account");
        return json({ account: bankSummary(saved) }, 201);
      }
      const accounts = records.map(bankSummary).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const flagged = accounts.filter((account) => account.current);
      const currentIssue = flagged.length > 1 || flagged.some((account) => account.status !== "Verified");
      return json({ accounts, currentAccount: !currentIssue && flagged.length === 1 ? flagged[0] : null, currentIssue });
    } catch {
      return json({ error: request.method === "POST" ? "Unable to confirm your details were saved. Refresh banking details before trying again." : "Unable to load banking details. Please try again." }, 502);
    }
  };
}
