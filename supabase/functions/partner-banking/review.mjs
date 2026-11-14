const recordId = /^rec[A-Za-z0-9]{14}$/;
const bankFields = ["Submission ID", "Partner", "Partner ID", "Institution name", "Account holder", "Account number", "Institution code", "Transit number", "Currency", "Status", "Current account", "Review notes", "Submitted at", "Last modified"];
class ReviewError extends Error { constructor(message, status = 409) { super(message); this.status = status; } }
const owner = (row) => recordId.test(row?.fields?.["Partner ID"] || "") && row.fields.Partner?.length === 1 && row.fields.Partner[0] === row.fields["Partner ID"];
const summary = (row) => ({ id: row.id, partnerId: row.fields["Partner ID"], submissionId: row.fields["Submission ID"] || "", holder: row.fields["Account holder"] || "", bank: row.fields["Institution name"] || "", institutionCode: row.fields["Institution code"] || "", transitNumber: row.fields["Transit number"] || "", account: row.fields["Account number"] || "", currency: row.fields.Currency || "", status: row.fields.Status || "Pending verification", current: row.fields["Current account"] === true, reviewNotes: row.fields["Review notes"] || "", submittedAt: row.fields["Submitted at"] || row.createdTime || "", modifiedAt: row.fields["Last modified"] || "", validOwnership: owner(row) });

export async function bankingReview({ request, env, user, admin, fetchImpl, json }) {
  if (user.app_metadata?.role !== "partner_admin") return json({ error: "Administrator access is required." }, 403);
  const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
  const table = env.AIRTABLE_BANKING_TABLE_ID || "Banking_details_api";
  const url = `${base}/${encodeURIComponent(table)}`;
  const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
  async function airtable(target, options = {}) {
    const response = await fetchImpl(target, { ...options, headers, signal: AbortSignal.timeout(15000) });
    if (response.status === 404) throw new ReviewError("The bank submission was not found.", 404);
    if (!response.ok) throw new Error("Airtable review failed");
    return response.json();
  }
  async function list(target, fields, formula) {
    const rows = [], seen = new Set(); let offset;
    do {
      const pageUrl = new URL(target);
      for (const field of fields) pageUrl.searchParams.append("fields[]", field);
      if (formula) pageUrl.searchParams.set("filterByFormula", formula);
      if (offset) pageUrl.searchParams.set("offset", offset);
      const body = await airtable(pageUrl);
      if (!Array.isArray(body.records)) throw new Error("Invalid Airtable page");
      rows.push(...body.records);
      offset = body.offset;
      if (offset && (typeof offset !== "string" || seen.has(offset))) throw new Error("Invalid pagination");
      if (offset) seen.add(offset);
    } while (offset);
    return rows;
  }
  async function get(id) {
    const row = await airtable(`${url}/${id}`);
    if (row.id !== id || !row.fields) throw new Error("Invalid submission");
    return row;
  }
  async function rpc(name, args) {
    if (!admin) throw new Error("Review service not configured");
    const result = await admin.rpc(name, args);
    if (result.error) throw new Error("Review lock failed");
    return result.data;
  }
  let partnerId, token;
  try {
    if (request.method === "GET") {
      const rows = await list(url, bankFields);
      const ids = [...new Set(rows.filter(owner).map((row) => row.fields["Partner ID"]))];
      const partners = new Map();
      for (let start = 0; start < ids.length; start += 50) {
        const batch = ids.slice(start, start + 50);
        const records = await list(`${base}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || "Partners_api")}`, ["Name", "Contact", "Email"], `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`);
        for (const row of records) if (batch.includes(row.id)) partners.set(row.id, row.fields);
      }
      const submissions = rows.map((row) => {
        const value = summary(row), partner = partners.get(value.partnerId);
        return { ...value, partnerName: partner?.Name || "Unknown partner", contact: partner?.Contact || "", email: partner?.Email || "" };
      }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      return json({ submissions });
    }
    const raw = await request.text();
    if (raw.length > 5000) return json({ error: "Review notes are too long." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    if (!body || Object.keys(body).some((key) => !["id", "action", "reviewNotes", "expectedModifiedAt"].includes(key)) ||
        !recordId.test(body.id || "") || !["approve", "reject"].includes(body.action) || typeof body.reviewNotes !== "string" || body.reviewNotes.length > 2000 ||
        typeof body.expectedModifiedAt !== "string" || (body.action === "reject" && !body.reviewNotes.trim())) return json({ error: "Check the submission and include a reason when rejecting." }, 400);
    const original = await get(body.id);
    if (!owner(original)) return json({ error: "The partner link is inconsistent. Correct it before reviewing." }, 409);
    partnerId = original.fields["Partner ID"]; token = crypto.randomUUID();
    if (!await rpc("claim_banking_review", { p_partner_id: partnerId, p_token: token })) {
      token = null; return json({ error: "Another review is in progress for this partner. Refresh and try again." }, 409);
    }
    const target = await get(body.id);
    if (!owner(target) || target.fields["Partner ID"] !== partnerId) throw new ReviewError("The partner link changed. Refresh before reviewing.");
    const notes = body.reviewNotes.trim(), f = target.fields;
    const alreadyDone = body.action === "approve" ? f.Status === "Verified" && f["Current account"] === true : f.Status === "Rejected" && !f["Current account"];
    if (!alreadyDone && (f["Last modified"] || "") !== body.expectedModifiedAt) throw new ReviewError("This submission changed since you opened it. Refresh before reviewing.");
    if (!alreadyDone && (f.Status || "Pending verification") !== "Pending verification") throw new ReviewError("Only pending submissions can be reviewed.");
    if (body.action === "approve" && (!f["Account holder"]?.trim() || !f["Institution name"]?.trim() || !/^\d{3}$/.test(f["Institution code"]) || !/^\d{5}$/.test(f["Transit number"]) || !/^\d{4,34}$/.test(f["Account number"]) || f.Currency !== "CAD")) throw new ReviewError("The submission has incomplete or invalid bank details.");
    async function patch(records) {
      if (!await rpc("renew_banking_review", { p_partner_id: partnerId, p_token: token })) throw new ReviewError("The review lock expired. Refresh before trying again.");
      const body = await airtable(url, { method: "PATCH", body: JSON.stringify({ records }) });
      if (!Array.isArray(body.records) || records.some((expected) => !body.records.some((actual) => actual.id === expected.id && Object.entries(expected.fields).every(([key, value]) => (actual.fields?.[key] ?? (value === false ? false : "")) === value)))) throw new Error("Review result unconfirmed");
    }
    if (body.action === "approve") {
      const related = await list(url, bankFields, `{Partner ID}='${partnerId}'`);
      if (related.some((row) => !owner(row) || row.fields["Partner ID"] !== partnerId)) throw new ReviewError("There are inconsistent partner links. Correct them before approving.");
      const previous = related.filter((row) => row.id !== target.id && row.fields["Current account"] === true);
      for (let start = 0; start < previous.length; start += 10) await patch(previous.slice(start, start + 10).map((row) => ({ id: row.id, fields: { "Current account": false } })));
      if (!alreadyDone) await patch([{ id: target.id, fields: { Status: "Verified", "Current account": true, "Review notes": notes } }]);
      // Read the resulting state before confirming approval. Airtable edits outside this service are not locked.
      const confirmed = await list(url, bankFields, `{Partner ID}='${partnerId}'`);
      const current = confirmed.filter((row) => row.fields["Current account"] === true);
      if (current.length !== 1 || current[0].id !== target.id || current[0].fields.Status !== "Verified" || !owner(current[0])) throw new Error("Current account not confirmed");
    } else if (!alreadyDone) {
      if (f["Current account"]) throw new ReviewError("The current account cannot be rejected.");
      await patch([{ id: target.id, fields: { Status: "Rejected", "Review notes": notes } }]);
    }
    if (!await rpc("complete_banking_review", { p_partner_id: partnerId, p_token: token, p_record_id: target.id, p_action: body.action, p_actor: user.id })) throw new Error("Review audit unconfirmed");
    token = null;
    return json({ reviewed: true });
  } catch (error) {
    return json({ error: error instanceof ReviewError ? error.message : "Unable to confirm the review. Refresh the list before trying again." }, error instanceof ReviewError ? error.status : 502);
  } finally {
    if (token) { try { await rpc("release_banking_review", { p_partner_id: partnerId, p_token: token }); } catch { /* Lease expires without granting another caller premature access. */ } }
  }
}
