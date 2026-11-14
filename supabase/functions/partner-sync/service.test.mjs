import test from "node:test";
import assert from "node:assert/strict";
import { createPartnerSyncHandler, mirrorFields, MIRROR_FIELDS } from "./service.mjs";

const id = "10000000-0000-4000-8000-000000000001";
const row = { id, company: "Partner", name: "Alex", email: "alex@example.com", user_id: "user-1", partner_id: "rec12345678901234", account_status: "Active", created_at: "2026-11-13T12:00:00Z", deleted_at: null };
const job = { registration_id: id, revision: 7, lock_token: "lease-token" };
const env = { PARTNER_SYNC_SECRET: "worker-secret", AIRTABLE_TOKEN: "airtable-private", AIRTABLE_BASE_ID: "app12345678901234", AIRTABLE_PARTNERS_TABLE_ID: "tbl12345678901234" };

function setup(options = {}) {
  const calls = [], finishes = [];
  const rows = options.rows || [row];
  const jobs = options.jobs || [job];
  const store = {
    async claim() { calls.push("claim"); return jobs; },
    async snapshots(ids) { calls.push("snapshot"); assert.deepEqual(ids, jobs.map((value) => value.registration_id)); return rows; },
    async finish(claimed, result) { finishes.push({ claimed, result }); return true; },
  };
  const handler = createPartnerSyncHandler({ env: { ...env, ...options.env }, store, fetchImpl: async (url, input) => {
    calls.push("airtable");
    assert.ok(String(url).startsWith("https://api.airtable.com/v0/app12345678901234/tbl12345678901234"));
    assert.equal(input.headers.Authorization, "Bearer airtable-private");
    if (options.status) return Response.json({ error: { message: "private-token raw provider body" } }, { status: options.status, headers: { "Retry-After": "180" } });
    if (!input.method) {
      assert.deepEqual(new URL(url).searchParams.getAll("fields[]"), MIRROR_FIELDS);
      return Response.json({ records: [] });
    }
    assert.equal(input.method, "PATCH");
    const body = JSON.parse(input.body);
    assert.deepEqual(body.performUpsert.fieldsToMergeOn, ["Portal ID"]);
    assert.equal(body.records.length, rows.length);
    for (const record of body.records) {
      assert.deepEqual(Object.keys(record.fields).sort(), [...MIRROR_FIELDS].sort());
      assert.ok(!("Referrals" in record.fields));
      assert.ok(!("encrypted_password" in record.fields));
      assert.equal(record.fields["Portal ID"], rows.find((source) => source.id === record.fields["Portal ID"]).id);
    }
    let records = body.records.map((record) => ({ ...record, id: record.id || "rec98765432109876" }));
    if (options.wrongValue) records[0].fields.Email = "other@example.com";
    if (options.wrongTarget) records[0].id = "rec98765432109876";
    if (options.duplicate) records = [records[0], records[0]];
    if (options.reverse) records.reverse();
    return Response.json({ records });
  } });
  const request = (body = {}, credential = env.PARTNER_SYNC_SECRET, method = "POST") => handler(new Request("https://project.example/functions/v1/partner-sync", {
    method, headers: credential ? { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" } : {},
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  }));
  return { request, calls, finishes };
}

test("worker rejects anonymous requests and user JWTs before touching data", async () => {
  for (const credential of [null, "ordinary-user-jwt", "wrong-secret"]) {
    const fixture = setup();
    assert.equal((await fixture.request({}, credential)).status, 401);
    assert.deepEqual(fixture.calls, []);
  }
});
test("unsupported methods, wrong modes and missing configuration cannot sync", async () => {
  const fixture = setup();
  assert.equal((await fixture.request({}, null, "GET")).status, 405);
  assert.equal((await fixture.request({ mode: "delete" })).status, 400);
  const missing = setup({ env: { AIRTABLE_PARTNERS_TABLE_ID: "" } });
  assert.equal((await missing.request()).status, 503);
  assert.deepEqual(missing.calls, []);
});
test("field check verifies the exact whitelist without returning personal records", async () => {
  const fixture = setup();
  const response = await fixture.request({ mode: "check" });
  assert.deepEqual(await response.json(), { fieldsReady: true });
  assert.deepEqual(fixture.calls, ["airtable"]);
});
test("empty queues never call Airtable", async () => {
  const fixture = setup({ jobs: [] });
  assert.deepEqual(await (await fixture.request()).json(), { synced: 0, pending: 0 });
  assert.deepEqual(fixture.calls, ["claim"]);
});
test("full mirror preserves record identity and acknowledges only the claimed revision", async () => {
  const fixture = setup();
  assert.deepEqual(await (await fixture.request()).json(), { synced: 1, pending: 0 });
  assert.deepEqual(fixture.finishes, [{ claimed: job, result: { partnerId: row.partner_id } }]);
});
test("deleted and reactivated accounts clear obsolete values without deleting Airtable history", async () => {
  const deleted = { ...row, user_id: null, deleted_at: "2026-11-13T13:00:00Z", account_status: "Deleted", encrypted_password: "must-never-leave" };
  const fixture = setup({ rows: [deleted] });
  assert.equal((await fixture.request()).status, 200);
  assert.equal(mirrorFields(deleted)["Supabase User ID"], null);
  assert.equal(mirrorFields({ ...row, deleted_at: null })["Deleted at"], null);
  assert.ok(!Object.values(mirrorFields(deleted)).includes("must-never-leave"));
});
test("all supported account states are mirrored exactly", () => {
  for (const status of ["Active", "Deactivated", "Awaiting activation", "Setup incomplete", "Deleted"]) {
    assert.equal(mirrorFields({ ...row, account_status: status })["Account status"], status);
  }
});
test("multiple accounts are sent in one request and unordered responses map by Portal ID", async () => {
  const second = { ...row, id: "second", partner_id: "rec98765432109876", email: "second@example.com" };
  const fixture = setup({ rows: [row, second], jobs: [job, { ...job, registration_id: second.id }], reverse: true });
  assert.deepEqual(await (await fixture.request()).json(), { synced: 2, pending: 0 });
  assert.equal(fixture.calls.filter((value) => value === "airtable").length, 1);
  assert.equal(fixture.finishes[0].result.partnerId, row.partner_id);
  assert.equal(fixture.finishes[1].result.partnerId, second.partner_id);
});
test("interrupted provisioning upserts by Portal ID and records the Airtable ID", async () => {
  const fixture = setup({ rows: [{ ...row, partner_id: null }] });
  assert.equal((await fixture.request()).status, 200);
  assert.equal(fixture.finishes[0].result.partnerId, "rec98765432109876");
});
test("missing fields, permissions and rate limits stay queued without leaking provider data", async () => {
  for (const status of [422, 403, 429, 500]) {
    const fixture = setup({ status });
    const response = await fixture.request();
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.ok(!body.includes("private-token"));
    assert.ok(!body.includes(env.AIRTABLE_TOKEN));
    assert.ok(fixture.finishes[0].result.error);
    assert.equal(fixture.finishes[0].result.partnerId, undefined);
    if (status === 429) assert.equal(fixture.finishes[0].result.retry, 180);
  }
});
test("wrong returned values or record IDs cannot be acknowledged as synchronized", async () => {
  for (const option of [{ wrongValue: true }, { wrongTarget: true }, { duplicate: true }]) {
    const fixture = setup(option);
    assert.equal((await fixture.request()).status, 502);
    assert.ok(fixture.finishes[0].result.error);
  }
});
test("invalid targets and missing source rows never write to Airtable", async () => {
  for (const rows of [[], [{ ...row, partner_id: "not-a-record" }]]) {
    const fixture = setup({ rows });
    assert.equal((await fixture.request()).status, 502);
    assert.ok(!fixture.calls.includes("airtable"));
  }
});
