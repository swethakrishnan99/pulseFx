export const MIRROR_FIELDS = ["Name", "Portal ID", "Contact", "Email", "Supabase User ID", "Account status", "Registered at", "Deleted at"];
const recordId = /^rec[A-Za-z0-9]{14}$/;
const statuses = new Set(["Setup incomplete", "Awaiting activation", "Active", "Deactivated", "Deleted"]);
class SyncFailure extends Error {
  constructor(code, retry = 60) { super(code); this.code = code; this.retry = retry; }
}
function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function checked(result) {
  if (result.error) throw new SyncFailure("database_unavailable");
  return result.data;
}
async function authenticated(actual, expected) {
  if (!actual || !expected) return false;
  const encode = (value) => new TextEncoder().encode(value);
  const [a, b] = await Promise.all([actual, expected].map((value) => crypto.subtle.digest("SHA-256", encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
export function mirrorFields(row) {
  if (!row.id || !row.company || !row.email || !statuses.has(row.account_status)) throw new SyncFailure("invalid_source_record");
  // Deliberately whitelist fields: never copy auth metadata, tokens or hashes.
  return {
    Name: row.company, "Portal ID": row.id, Contact: row.name || null, Email: row.email,
    "Supabase User ID": row.user_id || null, "Account status": row.account_status,
    "Registered at": row.created_at || null, "Deleted at": row.deleted_at || null,
  };
}
function reflectsSource(actual, expected) {
  return MIRROR_FIELDS.every((name) => {
    if (expected[name] === null) return actual[name] == null;
    if (["Registered at", "Deleted at"].includes(name)) return new Date(actual[name]).getTime() === new Date(expected[name]).getTime();
    return actual[name] === expected[name];
  });
}
export function createSyncStore(admin) {
  return {
    async claim() { return checked(await admin.rpc("claim_partner_airtable_sync", { p_limit: 10 })); },
    async snapshots(ids) { return checked(await admin.rpc("partner_airtable_snapshots", { p_ids: ids })); },
    async finish(job, result) {
      return checked(await admin.rpc("finish_partner_airtable_sync", {
        p_id: job.registration_id, p_revision: job.revision, p_token: job.lock_token,
        p_partner_id: result.partnerId || null, p_error: result.error || null, p_retry_seconds: result.retry || 60,
      }));
    },
  };
}
async function airtableResponse(response) {
  if (response.status === 429) {
    const delay = Number(response.headers.get("retry-after"));
    throw new SyncFailure("airtable_rate_limited", Number.isFinite(delay) ? Math.max(60, Math.min(delay, 3600)) : 60);
  }
  if (response.status === 401 || response.status === 403) throw new SyncFailure("airtable_permission_denied", 300);
  if (response.status === 422) throw new SyncFailure("airtable_fields_need_configuration", 300);
  if (!response.ok) throw new SyncFailure("airtable_unavailable");
  return response.json();
}

export function createPartnerSyncHandler({ env, admin, store = admin ? createSyncStore(admin) : null, fetchImpl = fetch }) {
  return async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const credential = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!await authenticated(credential, env.PARTNER_SYNC_SECRET)) return json({ error: "Unauthorized." }, 401);
    if (!store || !env.AIRTABLE_TOKEN || !/^app[A-Za-z0-9]{14}$/.test(env.AIRTABLE_BASE_ID || "") || !/^tbl[A-Za-z0-9]{14}$/.test(env.AIRTABLE_PARTNERS_TABLE_ID || "")) return json({ error: "Sync is not configured." }, 503);
    const body = await request.json().catch(() => null);
    if (!body || (body.mode && !["check", "sync"].includes(body.mode))) return json({ error: "Invalid request." }, 400);
    const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_PARTNERS_TABLE_ID}`;
    const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
    let jobs = [];
    try {
      if (body.mode === "check") {
        const checkUrl = new URL(url);
        checkUrl.searchParams.set("maxRecords", "1");
        for (const field of MIRROR_FIELDS) checkUrl.searchParams.append("fields[]", field);
        await airtableResponse(await fetchImpl(checkUrl, { headers, signal: AbortSignal.timeout(20000) }));
        return json({ fieldsReady: true });
      }
      jobs = await store.claim();
      if (!jobs.length) return json({ synced: 0, pending: 0 });
      const rows = await store.snapshots(jobs.map((job) => job.registration_id));
      const byId = new Map(rows.map((row) => [row.id, row]));
      if (jobs.some((job) => !byId.has(job.registration_id))) throw new SyncFailure("source_record_unavailable");
      const records = jobs.map((job) => {
        const row = byId.get(job.registration_id);
        if (row.partner_id && !recordId.test(row.partner_id)) throw new SyncFailure("invalid_target_record");
        return { ...(row.partner_id ? { id: row.partner_id } : {}), fields: mirrorFields(row) };
      });
      const result = await airtableResponse(await fetchImpl(url, {
        method: "PATCH", headers, body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["Portal ID"] }, records }),
        signal: AbortSignal.timeout(20000),
      }));
      if (!Array.isArray(result.records) || result.records.length !== jobs.length) throw new SyncFailure("invalid_airtable_response");
      const targets = new Map();
      for (const record of result.records) {
        const id = record.fields?.["Portal ID"];
        if (!byId.has(id) || targets.has(id) || !recordId.test(record.id) || (byId.get(id).partner_id && byId.get(id).partner_id !== record.id)) throw new SyncFailure("invalid_airtable_response");
        if (!reflectsSource(record.fields, mirrorFields(byId.get(id)))) throw new SyncFailure("airtable_values_not_confirmed");
        targets.set(id, record.id);
      }
      let synced = 0;
      for (const job of jobs) {
        if (await store.finish(job, { partnerId: targets.get(job.registration_id) })) synced++;
      }
      return json({ synced, pending: jobs.length - synced });
    } catch (error) {
      const failure = error instanceof SyncFailure ? error : new SyncFailure("sync_temporarily_unavailable");
      for (const job of jobs) await store.finish(job, { error: failure.code, retry: failure.retry }).catch(() => {});
      return json({ error: failure.code, pending: jobs.length }, 502);
    }
  };
}
