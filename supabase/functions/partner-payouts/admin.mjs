import { adminSessionValid } from "../_shared/admin-session.mjs";

const recordId = /^rec[A-Za-z0-9]{14}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = ["Reference", "Partner", "Partner ID", "Client", "Amount", "Currency", "Status", "Paid at", "Notes"];
const bankFields = ["Partner", "Partner ID", "Institution code", "Transit number", "Institution name", "Account holder", "Account number", "Currency", "Status", "Current account"];
const statuses = ["Pending", "Paid", "Failed", "Cancelled"];
const text = (value) => typeof value === "string" ? value : "";
class PayoutError extends Error { constructor(message, status = 409) { super(message); this.status = status; } }
const check = (result) => { if (result.error) throw new Error("Payout operation failed"); return result.data; };
const owns = (row) => recordId.test(row?.fields?.["Partner ID"] || "") && row.fields.Partner?.length === 1 && row.fields.Partner[0] === row.fields["Partner ID"];
const iso = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";
function summary(row, names = new Map()) {
  const f = row.fields;
  return { id: row.id, ref: text(f.Reference), partnerId: text(f["Partner ID"]), partnerName: names.get(f["Partner ID"]) || "Unknown partner",
    client: text(f.Client), amount: typeof f.Amount === "number" && Number.isFinite(f.Amount) ? f.Amount : null,
    currency: text(f.Currency) || "CAD", status: text(f.Status) || "Pending", date: iso(f["Paid at"]), notes: text(f.Notes), validOwnership: owns(row) };
}
export function payoutSnapshot(row) {
  return { ref: row.ref, partnerId: row.partnerId, client: row.client, amount: row.amount, currency: row.currency, status: row.status, date: row.date, notes: row.notes };
}
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function snapshotFields(row) {
  return { Reference: row.ref, Partner: [row.partnerId], "Partner ID": row.partnerId, Client: row.client,
    Amount: row.amount, Currency: row.currency, Status: row.status, "Paid at": row.date || null, Notes: row.notes };
}
function matches(row, expected) {
  return owns(row) && Object.entries(expected).every(([key, value]) => {
    const actual = row.fields?.[key];
    if (key === "Partner") return equal(actual, value);
    if (key === "Paid at") return iso(actual) === iso(value);
    if (key === "Amount") return typeof actual === "number" && Math.abs(actual - value) < 0.000001;
    return (actual ?? "") === (value ?? "");
  });
}
function paymentDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return "";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? iso(value) : "";
}
function input(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || !["create", "edit", "cancel"].includes(body.action) || !uuid.test(body.requestId || "")) throw new PayoutError("Invalid payout request.", 400);
  const allowed = ["action", "requestId", "id", "partnerId", "ref", "client", "clientId", "amount", "status", "date", "notes", "expected"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new PayoutError("Invalid payout fields.", 400);
  if (body.action !== "create" && (!recordId.test(body.id || "") || !body.expected || typeof body.expected !== "object")) throw new PayoutError("Select a payout and refresh its details.", 400);
  if (body.action === "cancel") return { action: body.action, id: body.id, expected: payoutSnapshot(body.expected) };
  const ref = text(body.ref).trim(), partnerId = body.partnerId, client = text(body.client).trim(), notes = text(body.notes).trim();
  const amountText = typeof body.amount === "number" ? String(body.amount) : body.amount;
  if (!/^[A-Za-z0-9][A-Za-z0-9 _./-]{0,79}$/.test(ref) || !recordId.test(partnerId || "") || client.length > 500 || notes.length > 2000
    || !/^\d{1,9}(\.\d{1,2})?$/.test(amountText || "") || Number(amountText) <= 0 || !["Pending", "Paid", "Failed"].includes(body.status)) {
    throw new PayoutError("Enter a reference, partner, positive CAD amount with up to two decimals and a valid status.", 400);
  }
  if (body.clientId && !recordId.test(body.clientId)) throw new PayoutError("Select a referred client from the list.", 400);
  if (client && !body.clientId && (body.action === "create" || client !== body.expected?.client)) throw new PayoutError("Select a referred client from the list.", 400);
  if ((body.status === "Paid" && !paymentDate(body.date)) || (body.status !== "Paid" && body.date)) throw new PayoutError("Include the payment date only for a paid payout.", 400);
  return { action: body.action, clientId: body.clientId || "", ...(body.action === "edit" ? { id: body.id, expected: payoutSnapshot(body.expected) } : {}),
    fields: { Reference: ref, Partner: [partnerId], "Partner ID": partnerId, Client: client, Amount: Number(amountText), Currency: "CAD", Status: body.status, "Paid at": body.status === "Paid" ? iso(body.date) : null, Notes: notes } };
}
export function createPayoutStore(admin) {
  return {
    async partners() { return check(await admin.rpc("list_partner_admin_accounts")); },
    async claim(token) { return check(await admin.rpc("claim_payout_admin_write", { p_token: token })); },
    async renew(token) { return check(await admin.rpc("renew_payout_admin_write", { p_token: token })); },
    async release(token) { return check(await admin.rpc("release_payout_admin_write", { p_token: token })); },
    async operation(id) { return check(await admin.from("payout_admin_operations").select("*").eq("request_id", id).maybeSingle()); },
    async prepare(id, actor, values) { check(await admin.from("payout_admin_operations").insert({ request_id: id, actor_id: actor, action: values.action, input: values })); },
    async complete(id, result) { check(await admin.from("payout_admin_operations").update({ result, completed_at: new Date().toISOString() }).eq("request_id", id)); },
  };
}

export async function adminPayouts({ request, env, user, admin, fetchImpl, json, store = createPayoutStore(admin) }) {
  if (user.app_metadata?.role !== "partner_admin") return json({ error: "Administrator access is required." }, 403);
  let token;
  const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
  const payoutUrl = `${base}/${encodeURIComponent(env.AIRTABLE_PAYOUTS_TABLE_ID || "Payouts_api")}`;
  const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
  async function airtable(url, options = {}) {
    const response = await fetchImpl(url, { ...options, headers, signal: AbortSignal.timeout(15000) });
    if (response.status === 404) throw new PayoutError("The record was not found. Refresh and try again.", 404);
    if (!response.ok) throw new Error("Payout data unavailable");
    return response.json();
  }
  async function list(url, select, formula) {
    const rows = [], seen = new Set(); let offset;
    do {
      const page = new URL(url);
      for (const field of select) page.searchParams.append("fields[]", field);
      if (formula) page.searchParams.set("filterByFormula", formula);
      if (offset) page.searchParams.set("offset", offset);
      const result = await airtable(page);
      if (!Array.isArray(result.records)) throw new Error("Invalid payout page");
      rows.push(...result.records); offset = result.offset;
      if (offset && (typeof offset !== "string" || seen.has(offset))) throw new Error("Invalid payout pagination");
      if (offset) seen.add(offset);
    } while (offset);
    return rows;
  }
  async function get(id) {
    const row = await airtable(`${payoutUrl}/${id}`);
    if (row.id !== id || !row.fields) throw new Error("Invalid payout record");
    return row;
  }
  async function partnerReferralIds(partnerId) {
    const partner = await airtable(`${base}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || "Partners_api")}/${partnerId}`);
    const ids = partner.fields?.Referrals || [];
    if (partner.id !== partnerId || !Array.isArray(ids) || ids.some((id) => !recordId.test(id))) throw new Error("Invalid partner referrals");
    return [...new Set(ids)];
  }
  const referralSummary = (row) => ({ id: row.id, company: text(row.fields.Company) || text(row.fields.Contact) || "Unnamed client", email: text(row.fields.Email) });
  const referralBelongs = (row, partnerId) => Array.isArray(row.fields?.Partner) && row.fields.Partner.length === 1 && row.fields.Partner[0] === partnerId;
  const referralTable = `${base}/${encodeURIComponent(env.AIRTABLE_REFERRALS_TABLE_ID || "Referrals_api")}`;
  try {
    if (!await adminSessionValid(admin, user.id, request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "")) return json({ error: "Please sign in again." }, 401);
    if (request.method === "GET" && new URL(request.url).searchParams.has("partnerId")) {
      const partnerId = new URL(request.url).searchParams.get("partnerId");
      if (!recordId.test(partnerId || "") || !(await store.partners()).some((row) => row.partner_id === partnerId && row.ready && !row.deleted_at)) throw new PayoutError("Select a provisioned partner.", 400);
      const ids = await partnerReferralIds(partnerId);
      const referrals = [];
      for (let start = 0; start < ids.length; start += 50) {
        const batch = ids.slice(start, start + 50);
        const records = await list(referralTable, ["Company", "Contact", "Email", "Partner"], `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`);
        referrals.push(...records.filter((row) => batch.includes(row.id) && referralBelongs(row, partnerId)).map(referralSummary));
      }
      return json({ referrals: [...new Map(referrals.map((row) => [row.id, row])).values()].sort((a, b) => a.company.localeCompare(b.company) || a.email.localeCompare(b.email)) });
    }
    if (request.method === "GET") {
      const [registrations, rows, banks] = await Promise.all([
        store.partners(), list(payoutUrl, fields), list(`${base}/${encodeURIComponent(env.AIRTABLE_BANKING_TABLE_ID || "Banking_details_api")}`, bankFields),
      ]);
      const partners = registrations.filter((row) => row.ready && recordId.test(row.partner_id || "") && !row.deleted_at).map((row) => {
        const flagged = banks.filter((bank) => bank.fields?.["Partner ID"] === row.partner_id && bank.fields["Current account"] === true);
        const valid = flagged.length === 1 && owns(flagged[0]) && flagged[0].fields.Status === "Verified" && flagged[0].fields.Currency === "CAD"
          && /^\d{4,34}$/.test(flagged[0].fields["Account number"] || "") && text(flagged[0].fields["Account holder"]).trim() && text(flagged[0].fields["Institution name"]).trim();
        const bank = valid ? flagged[0].fields : null;
        return { id: row.partner_id, name: row.company, contact: row.name, email: row.email, disabled: !!row.disabled,
          bankingStatus: valid ? "Verified" : flagged.length ? "Needs review" : "No verified account",
          bank: bank ? { name: text(bank["Institution name"]), holder: text(bank["Account holder"]), institutionCode: text(bank["Institution code"]), transitNumber: text(bank["Transit number"]), account: text(bank["Account number"]), last4: text(bank["Account number"]).slice(-4), currency: "CAD" } : null };
      }).sort((a, b) => a.name.localeCompare(b.name));
      const names = new Map(partners.map((partner) => [partner.id, partner.name]));
      const missingIds = [...new Set(rows.map((row) => row.fields?.["Partner ID"]).filter((id) => recordId.test(id || "") && !names.has(id)))];
      for (let start = 0; start < missingIds.length; start += 50) {
        const batch = missingIds.slice(start, start + 50);
        const historical = await list(`${base}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || "Partners_api")}`, ["Name"], `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`);
        for (const row of historical) if (batch.includes(row.id)) names.set(row.id, text(row.fields?.Name));
      }
      return json({ partners, payouts: rows.map((row) => summary(row, names)).sort((a, b) => b.date.localeCompare(a.date) || a.ref.localeCompare(b.ref)) });
    }
    const raw = await request.text();
    if (raw.length > 10000) return json({ error: "Payout details are too long." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    const values = input(body);
    token = crypto.randomUUID();
    if (!await store.claim(token)) { token = null; return json({ error: "Another payout is being saved. Please try again.", }, 409); }
    let op = await store.operation(body.requestId);
    if (op && (!equal(values.action === "cancel" ? op.input : { ...op.input, clientId: op.input.clientId || "" }, values) || op.actor_id !== user.id)) throw new PayoutError("This request ID was already used. Refresh before making another change.");
    if (op?.result) return json(op.result);
    let existing;
    if (values.action === "create") {
      const partner = (await store.partners()).find((row) => row.partner_id === values.fields["Partner ID"] && row.ready && !row.deleted_at);
      if (!partner) throw new PayoutError("Select a provisioned partner from the list.", 400);
      const matchesRef = await list(payoutUrl, fields, `{Reference}='${values.fields.Reference}'`);
      if (matchesRef.length > 1 || (!op && matchesRef.length)) throw new PayoutError("This reference already exists. Use a unique payout reference.");
      if (matchesRef.length) {
        if (!matches(matchesRef[0], values.fields)) throw new PayoutError("This reference has different payout details. Refresh before trying again.");
        existing = matchesRef[0];
      }
    } else {
      const row = await get(values.id);
      if (!owns(row) || !statuses.includes(row.fields.Status || "Pending") || (row.fields.Currency || "CAD") !== "CAD") throw new PayoutError("This payout has inconsistent partner or currency details. Correct it before editing.");
      const current = summary(row);
      const desired = values.action === "cancel" ? { ...snapshotFields(values.expected), Status: "Cancelled" } : values.fields;
      // Recover an interrupted write only when this request had already saved its intent.
      if (op && matches(row, desired)) existing = row;
      else {
        if (!equal(payoutSnapshot(current), values.expected)) throw new PayoutError("This payout changed since you opened it. Refresh before saving.");
        if (["Paid", "Cancelled"].includes(current.status)) throw new PayoutError("Paid and cancelled payouts are kept as read-only history.");
        if (values.action === "edit" && (values.fields.Reference !== current.ref || values.fields["Partner ID"] !== current.partnerId)) throw new PayoutError("The partner and reference cannot be changed after creation.");
      }
      if (values.action === "cancel") values.fields = { Status: "Cancelled" };
    }
    if (!op && values.action !== "cancel" && values.clientId) {
      const partnerId = values.fields["Partner ID"];
      const ids = await partnerReferralIds(partnerId);
      if (!ids.includes(values.clientId)) throw new PayoutError("This client was not referred by the selected partner.", 400);
      const referral = await airtable(`${referralTable}/${values.clientId}`);
      if (referral.id !== values.clientId || !referralBelongs(referral, partnerId)) throw new PayoutError("This client was not referred by the selected partner.", 400);
      const client = referralSummary(referral);
      const label = `${client.company} | ${client.email}`;
      if (label !== values.fields.Client) throw new PayoutError("The referred client details changed. Reload the client list before saving.");
    }
    // Store the original normalized input; cancellation adds patch fields only after the intent comparison.
    if (!op) {
      const savedInput = input(body);
      await store.prepare(body.requestId, user.id, savedInput);
      op = { input: savedInput };
    }
    if (!existing) {
      if (!await store.renew(token)) throw new PayoutError("The payout save lock expired. Refresh before trying again.");
      const result = await airtable(values.action === "create" ? payoutUrl : `${payoutUrl}/${values.id}`, {
        method: values.action === "create" ? "POST" : "PATCH", body: JSON.stringify({ fields: values.fields }),
      });
      if (!recordId.test(result.id || "") || (values.action !== "create" && result.id !== values.id)) throw new Error("Unconfirmed payout ID");
      existing = await get(result.id);
      if (!matches(existing, values.fields)) throw new Error("Unconfirmed payout save");
      if (values.action === "cancel" && !equal(payoutSnapshot(summary(existing)), { ...values.expected, status: "Cancelled" })) throw new Error("Unconfirmed cancellation");
    }
    const result = { payout: summary(existing) };
    await store.complete(body.requestId, result);
    return json(result);
  } catch (error) {
    return json({ error: error instanceof PayoutError ? error.message : "Unable to confirm the payout was saved. Refresh the list before trying again." }, error instanceof PayoutError ? error.status : 502);
  } finally {
    if (token) { try { await store.release(token); } catch { /* The lease expires safely. */ } }
  }
}
