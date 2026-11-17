import { adminSessionValid } from "../_shared/admin-session.mjs";

const recordId = /^rec[A-Za-z0-9]{14}$/;
const statuses = ["Invited", "Account created", "Documents submitted", "Under review", "Onboarded", "Rejected"];
class Failure extends Error { constructor(message, status = 502) { super(message); this.status = status; } }
const text = value => typeof value === "string" ? value : "";

export async function adminReferrals({ request, env, user, admin, fetchImpl, json, normalizeReferral }) {
  let token, lockedId, attemptedWrite = false;
  const rpc = async (name, args) => {
    const result = await admin.rpc(name, args);
    if (result.error) throw new Error("Referral lock unavailable");
    return result.data;
  };
  try {
    if (user.app_metadata?.role !== "partner_admin") throw new Failure("Administrator access is required.", 403);
    if (!admin || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_REFERRALS_TABLE_ID) throw new Failure("Referral follow-up is not configured.", 503);
    const bearer = request.headers.get("authorization").replace(/^Bearer\s+/i, "");
    if (!await adminSessionValid(admin, user.id, bearer)) throw new Failure("Please sign in again.", 401);
    const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
    const table = `${base}/${encodeURIComponent(env.AIRTABLE_REFERRALS_TABLE_ID)}`;
    const call = async (url, options = {}) => {
      const response = await fetchImpl(url, { ...options, headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) });
      if (response.status === 404) throw new Failure("Referral not found. Refresh the list.", 404);
      if (!response.ok) throw new Error("Airtable unavailable");
      return response.json();
    };
    const list = async (target, fields) => {
      const records = [], seen = new Set(); let offset;
      do {
        const url = new URL(target);
        if (offset) url.searchParams.set("offset", offset);
        for (const field of fields) url.searchParams.append("fields[]", field);
        const body = await call(url);
        if (!Array.isArray(body.records)) throw new Error("Invalid referrals");
        records.push(...body.records);
        offset = body.offset;
        if (offset && (typeof offset !== "string" || seen.has(offset))) throw new Error("Invalid pagination");
        if (offset) seen.add(offset);
      } while (offset);
      return records;
    };
    // Audit fields are returned only to administrators. Partner responses remain unchanged.
    const summary = record => ({ ...normalizeReferral(record),
      partnerId: record.fields.Partner?.[0] || "",
      modifiedByUserId: text(record.fields["Last modified by user ID"]),
      modifiedByEmail: text(record.fields["Last modified by email"]),
    });
    if (request.method === "GET") {
      // Read all fields so a missing new audit column does not prevent reviewing existing referrals.
      const records = await list(table, []);
      const partners = await list(`${base}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || "Partners_api")}`, ["Name"]);
      const names = new Map(partners.map(row => [row.id, text(row.fields?.Name)]));
      return json({ referrals: records.filter(row => recordId.test(row.id) && row.fields).map(row => ({ ...summary(row), partnerName: names.get(row.fields.Partner?.[0]) || "Unknown partner" }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    }
    const raw = await request.text();
    if (raw.length > 3000) throw new Failure("Invalid status update.", 400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new Failure("Invalid status update.", 400); }
    if (!body || Array.isArray(body) || Object.keys(body).some(key => !["id", "status", "expectedStatus", "expectedModifiedAt"].includes(key)) ||
        !recordId.test(body.id || "") || !statuses.includes(body.status) || typeof body.expectedStatus !== "string" ||
        typeof body.expectedModifiedAt !== "string") throw new Failure("Select a referral and a valid status.", 400);
    if (!user.email) throw new Failure("Your administrator account needs an email address.", 403);
    token = crypto.randomUUID();
    if (!await rpc("claim_referral_followup", { p_record_id: body.id, p_token: token })) throw new Failure("Another administrator is updating this referral. Refresh and try again.", 409);
    lockedId = body.id;
    const current = await call(`${table}/${body.id}`);
    if (current.id !== body.id || !current.fields) throw new Error("Invalid referral");
    const before = summary(current);
    if (before.status !== body.expectedStatus || before.modifiedAt !== body.expectedModifiedAt) throw new Failure("This referral changed since you opened it. Close the details and refresh before updating.", 409);
    if (before.status === body.status) return json({ referral: before });
    attemptedWrite = true;
    // Last modified is an Airtable computed field watching Status and both actor fields.
    const saved = await call(`${table}/${body.id}`, { method: "PATCH", body: JSON.stringify({ fields: {
      Status: body.status, "Last modified by user ID": user.id, "Last modified by email": user.email,
    } }) });
    if (saved.id !== body.id || saved.fields?.Status !== body.status || saved.fields?.["Last modified by user ID"] !== user.id || saved.fields?.["Last modified by email"] !== user.email) throw new Error("Update unconfirmed");
    return json({ referral: summary(saved) });
  } catch (error) {
    return json({ error: error instanceof Failure ? error.message : attemptedWrite
      ? "Unable to confirm the status was saved. Close the details and refresh before trying again."
      : "Unable to load or update referrals. Please try again." }, error instanceof Failure ? error.status : 502);
  } finally {
    if (lockedId) { try { await rpc("release_referral_followup", { p_record_id: lockedId, p_token: token }); } catch { /* Lease expires automatically. */ } }
  }
}
