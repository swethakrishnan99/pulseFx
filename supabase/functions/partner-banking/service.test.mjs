import test from "node:test";
import assert from "node:assert/strict";
import { createBankingHandler } from "./service.mjs";

const partnerId = "recAAAAAAAAAAAAAA";
const otherId = "recBBBBBBBBBBBBBB";
const submissionId = "10000000-0000-4000-8000-000000000001";
const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "public-key", AIRTABLE_TOKEN: "private-test-token", AIRTABLE_BASE_ID: "appTest" };
const input = (overrides = {}) => ({ submissionId, bank: "Test Bank", holder: "Test Partner", account: "00123456789", institutionCode: "001", transitNumber: "12345", currency: "CAD", ...overrides });
const record = (index, overrides = {}) => ({ id: "rec" + String(index).padStart(14, "0"), createdTime: "2026-11-10T10:00:00.000Z", fields: {
  "Submission ID": `${partnerId}:${submissionId}`, "Partner ID": partnerId, Partner: [partnerId],
  "Institution name": "Test Bank", "Account holder": "Test Partner", "Account number": "00123456789", "Institution code": "001", "Transit number": "12345",
  Currency: "CAD", Status: "Verified", "Current account": true, "Review notes": "Approved", "Submitted at": "2026-11-10T10:00:00.000Z", ...overrides,
} });
const req = (method = "GET", body, query = "") => new Request(`https://example.supabase.co/functions/v1/partner-banking${query}`, { method,
  headers: { Authorization: "Bearer session", "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
function setup(options = {}) {
  const calls = [], writes = [];
  const handler = createBankingHandler({ env: { ...env, ...options.env }, fetchImpl: async (url, init) => {
    url = new URL(url); calls.push({ url, init });
    if (url.origin === env.SUPABASE_URL) {
      assert.equal(init.headers.apikey, env.SUPABASE_ANON_KEY);
      assert.equal(init.headers.Authorization || init.headers.authorization, "Bearer session");
      if (url.pathname === "/auth/v1/user") return options.expired ? Response.json({}, { status: 401 }) : Response.json({ id: "partner-user" });
      assert.equal(url.pathname, "/rest/v1/partner_memberships");
      assert.equal(url.searchParams.get("user_id"), "eq.partner-user");
      return options.membershipFailure ? Response.json({}, { status: 500 }) : Response.json(options.memberships ?? [{ partner_id: partnerId }]);
    }
    assert.equal(url.origin, "https://api.airtable.com");
    assert.equal(init.headers.Authorization, `Bearer ${env.AIRTABLE_TOKEN}`);
    if (options.failure) return Response.json({ secret: env.AIRTABLE_TOKEN }, { status: 422 });
    if (init.method === "POST") {
      const body = JSON.parse(init.body); writes.push(body);
      if (options.writeFailure) return Response.json({ secret: env.AIRTABLE_TOKEN }, { status: 500 });
      return Response.json({ records: [record(9, { ...body.records[0].fields, ...options.savedFields })] });
    }
    assert.equal(url.searchParams.get("filterByFormula"), `{Partner ID}='${partnerId}'`);
    assert.ok(url.searchParams.getAll("fields[]").includes("Partner"));
    if (!url.pathname.endsWith('/Payouts_api')) {
      const fields = url.searchParams.getAll("fields[]");
      for (const name of ["Institution name", "Institution code", "Transit number"]) assert.ok(fields.includes(name));
      assert.equal(fields.includes("Bank name"), false);
      assert.equal(fields.includes("Institution and transit number"), false);
    }
    if (options.page) return Response.json(options.page(url));
    return Response.json({ records: url.pathname.endsWith('/Payouts_api') ? options.payouts ?? [] : options.accounts ?? [] });
  } });
  return { handler, calls, writes };
}

test("preflight and unsupported methods never query Auth or Airtable", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(req("OPTIONS"))).status, 204);
  assert.equal((await handler(req("DELETE"))).status, 405);
  assert.equal(calls.length, 0);
});
test("anonymous, expired, disabled/unlinked and invalid memberships cannot read or write", async () => {
  for (const method of ["GET", "POST"]) {
    for (const options of [{ expired: true }, { memberships: [] }, { memberships: [{ partner_id: "invalid" }] }]) {
      const { handler, calls, writes } = setup(options);
      const result = await handler(req(method, method === "POST" ? input() : undefined));
      assert.ok([401,403].includes(result.status));
      assert.ok(calls.every(({url})=>url.origin !== "https://api.airtable.com"));
      assert.equal(writes.length, 0);
    }
  }
  const { handler } = setup();
  assert.equal((await handler(new Request("https://example.test", { method: "GET" }))).status, 401);
});
test("membership failures fail closed", async () => {
  const { handler, calls } = setup({ membershipFailure: true });
  assert.equal((await handler(req())).status, 502);
  assert.equal(calls.length, 2);
});
test("only one verified flagged account is exposed as current; history is newest first and includes complete owned account numbers", async () => {
  const { handler } = setup({ accounts: [record(1), record(2, { Status: "Pending verification", "Current account": false, "Submitted at": "2026-11-12T15:00:00.000Z" })] });
  const response = await handler(req()); const body = await response.json();
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.currentAccount.id, record(1).id); assert.equal(body.currentIssue, false);
  assert.equal(body.accounts[0].id, record(2).id);
  assert.equal(body.accounts[0].last4, "6789");
  assert.equal(body.accounts[0].institutionCode, "001");
  assert.equal(body.accounts[0].transitNumber, "12345");
  assert.equal(body.accounts ? body.accounts[0].account : body.account.account, "00123456789");
  assert.equal(JSON.stringify(body).includes("00112345"), false);
  assert.equal(body.accounts[0].reviewNotes, "Approved");
});
test("unflagged verified accounts are historical, not implicitly current", async () => {
  const { handler } = setup({ accounts: [record(1, { "Current account": false })] });
  const body = await (await handler(req())).json(); assert.equal(body.currentAccount, null); assert.equal(body.currentIssue, false);
});
test("multiple current accounts or a pending/rejected current account require Pulse review", async () => {
  for (const accounts of [[record(1), record(2)], [record(1, { Status: "Pending verification" })], [record(1, { Status: "Rejected" })]]) {
    const { handler } = setup({ accounts }); const body = await (await handler(req())).json();
    assert.equal(body.currentAccount, null); assert.equal(body.currentIssue, true);
  }
});
test("inconsistent ownership is excluded even if upstream returns it", async () => {
  const { handler } = setup({ accounts: [record(1), record(2, { Partner: [otherId], "Account number": "9999999999" }), record(3, { "Partner ID": otherId }), record(4, { Partner: [partnerId, otherId] })] });
  const body = await (await handler(req())).json(); assert.equal(body.accounts.length, 1);
  assert.equal(JSON.stringify(body).includes("9999999999"), false);
});
test("empty state has no demo data", async () => {
  const { handler } = setup(); assert.deepEqual(await (await handler(req())).json(), { accounts: [], currentAccount: null, currentIssue: false });
});
test("each submission appends a new pending noncurrent record, preserving leading zeros and previous accounts", async () => {
  const { handler, writes } = setup({ accounts: [record(1, { "Submission ID": "previous" })] });
  const response = await handler(req("POST", input())); assert.equal(response.status, 201);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].records[0].fields, { "Submission ID": `${partnerId}:${submissionId}`, Partner: [partnerId], "Partner ID": partnerId,
    "Institution name": "Test Bank", "Account holder": "Test Partner", "Account number": "00123456789", "Institution code": "001", "Transit number": "12345", Currency: "CAD", Status: "Pending verification", "Current account": false });
  const body = await response.json(); assert.equal(body.account.last4, "6789"); assert.equal(body.account.status, "Pending verification");
  assert.equal(body.accounts ? body.accounts[0].account : body.account.account, "00123456789");
});
test("retries return the original record without resetting Pulse approval or duplicating it", async () => {
  const { handler, writes } = setup({ accounts: [record(1)] });
  const response = await handler(req("POST", input())); assert.equal(response.status, 200); assert.equal(writes.length, 0);
  assert.equal((await response.json()).account.status, "Verified");
});
test("reuse of a submission ID with changed details cannot overwrite history", async () => {
  const { handler, writes } = setup({ accounts: [record(1)] });
  assert.equal((await handler(req("POST", input({ account: "99999999" })))).status, 409); assert.equal(writes.length, 0);
});
test("server rejects invalid account details and attempts to set partner, current flag, review notes or approval", async () => {
  for (const overrides of [{ bank: " " }, { holder: "" }, { bank: "x".repeat(201) }, { account: "123" }, { account: "123abc" }, { account: "1".repeat(35) }, { institutionCode: "12" }, { institutionCode: "12x" }, { transitNumber: "1234" }, { transitNumber: "1234x" }, { routing: "00112345" }, { currency: "USD" }, { submissionId: "bad" }, { partnerId: otherId }, { Status: "Verified" }, { current: true }, { reviewNotes: "Approved" }]) {
    const { handler, writes } = setup(); assert.equal((await handler(req("POST", input(overrides)))).status, 400); assert.equal(writes.length, 0);
  }
});
test("malformed and oversized payloads are rejected without writes", async () => {
  const { handler, writes } = setup();
  assert.equal((await handler(new Request("https://example.test",{method:"POST",headers:{Authorization:"Bearer session"},body:"{"}))).status,400);
  assert.equal((await handler(req("POST",input({ bank: "x".repeat(5000) })))).status,413); assert.equal(writes.length,0);
});
test("unconfirmed or wrongly linked write responses never report success", async () => {
  for (const savedFields of [{ Partner: [otherId] }, { Status: "Verified" }, { "Current account": true }, { "Submission ID": "wrong" }, { "Account number": "wrong" }, { "Institution code": "wrong" }, { "Transit number": "wrong" }]) {
    const { handler } = setup({ savedFields }); assert.equal((await handler(req("POST", input()))).status, 502);
  }
});
test("read/write failures never expose upstream messages or banking numbers", async () => {
  for (const options of [{ failure: true }, { writeFailure: true }]) {
    const { handler } = setup(options); const response = await handler(req("POST", input()));
    assert.equal(response.status, 502); const text = await response.text();
    assert.equal(text.includes(env.AIRTABLE_TOKEN), false); assert.equal(text.includes(input().account), false);
  }
});
test("payouts are read-only, scoped by actual partner links and include real dates, amount and status", async () => {
  const paid = record(1, { Reference: "PO-001", Client: "Client", Amount: 125.5, Status: "Paid", "Paid at": "2026-11-12T15:00:00.000Z" });
  const { handler, writes } = setup({ payouts: [paid, record(2, { Partner: [otherId] })] });
  const body = await (await handler(req("GET", undefined, "?view=payouts"))).json();
  assert.equal(body.payouts.length, 1); assert.equal(body.payouts[0].amount, 125.5); assert.equal(body.payouts[0].date, "2026-11-12T15:00:00.000Z");
  assert.equal((await handler(req("POST", input(), "?view=payouts"))).status, 400); assert.equal(writes.length, 0);
});
test("query parameters cannot select another partner", async () => {
  const { handler, calls } = setup(); await handler(req("GET", undefined, `?partnerId=${otherId}`));
  assert.equal(calls[2].url.searchParams.get("filterByFormula"), `{Partner ID}='${partnerId}'`);
});
test("pagination retains ownership checks and repeated offsets fail safely", async () => {
  const { handler } = setup({ page: (url) => url.searchParams.has("offset") ? { records: [record(2)] } : { records: [record(1)], offset: "next" } });
  assert.equal((await (await handler(req())).json()).accounts.length, 2);
  const repeated = setup({ page: () => ({ records: [], offset: "same" }) }); assert.equal((await repeated.handler(req())).status, 502);
});
