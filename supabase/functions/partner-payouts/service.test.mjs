import test from "node:test";
import assert from "node:assert/strict";
import { createPayoutsHandler } from "./service.mjs";

const partnerId = "recAAAAAAAAAAAAAA", otherId = "recBBBBBBBBBBBBBB";
const env = { SUPABASE_URL: "https://project.example", SUPABASE_ANON_KEY: "public-key", AIRTABLE_TOKEN: "private-token", AIRTABLE_BASE_ID: "appTest" };
const record = (id, fields = {}) => ({ id: `rec${String(id).padStart(14, "0")}`, fields: {
  Reference: `PAY-${id}`, Partner: [partnerId], "Partner ID": partnerId, Client: "Company | client@example.test", Amount: 125.5,
  Currency: "CAD", Status: "Paid", "Paid at": "2026-11-14T15:00:00.000Z", Notes: "Visible notes", ...fields,
} });
const req = (method = "GET", query = "", token = "session") => new Request(`https://project.example/functions/v1/partner-payouts${query}`, {
  method, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(method === "POST" ? { body: JSON.stringify({ amount: 50 }) } : {}),
});
function setup(options = {}) {
  const calls = [];
  const handler = createPayoutsHandler({ env: { ...env, ...options.env }, fetchImpl: async (target, init) => {
    const url = new URL(target); calls.push({ url, init });
    if (url.origin === env.SUPABASE_URL) {
      assert.equal(init.headers.apikey, env.SUPABASE_ANON_KEY);
      assert.equal(init.headers.Authorization || init.headers.authorization, "Bearer session");
      if (url.pathname === "/auth/v1/user") return Response.json(options.user || { id: "partner-user" }, { status: options.authStatus || 200 });
      assert.equal(url.pathname, "/rest/v1/partner_memberships");
      assert.equal(url.searchParams.get("user_id"), "eq.partner-user");
      return options.membershipFailure ? Response.json({}, { status: 500 }) : Response.json(options.memberships || [{ partner_id: partnerId }]);
    }
    assert.equal(url.origin, "https://api.airtable.com");
    if (url.pathname === `/v0/appTest/${options.env?.AIRTABLE_BANKING_TABLE_ID || "Banking_details_api"}`) {
      assert.equal(url.searchParams.get("filterByFormula"), `{Partner ID}='${partnerId}'`);
      return Response.json(options.bankPage ? options.bankPage(url) : { records: options.banks || [] });
    }
    assert.equal(url.pathname, `/v0/appTest/${options.env?.AIRTABLE_PAYOUTS_TABLE_ID || "Payouts_api"}`);
    assert.equal(init.method, undefined, "partner history must never write");
    assert.equal(init.headers.Authorization, `Bearer ${env.AIRTABLE_TOKEN}`);
    assert.equal(url.searchParams.get("filterByFormula"), `{Partner ID}='${partnerId}'`);
    const fields = url.searchParams.getAll("fields[]");
    assert.ok(fields.includes("Partner")); assert.ok(fields.includes("Amount")); assert.equal(fields.includes("Account number"), false);
    if (options.failure) return Response.json({ error: env.AIRTABLE_TOKEN }, { status: 500 });
    return Response.json(options.page ? options.page(url) : { records: options.records || [] });
  } });
  return { handler, calls };
}

test("payout preflight, missing auth and unsupported methods never call upstream", async () => {
  const f = setup();
  assert.equal((await f.handler(req("OPTIONS"))).status, 204);
  assert.equal((await f.handler(req("DELETE"))).status, 405);
  assert.equal((await f.handler(req("GET", "", ""))).status, 401);
  assert.equal(f.calls.length, 0);
});
test("expired sessions, invalid users and unlinked or disabled partners are rejected", async () => {
  for (const options of [{ authStatus: 401 }, { authStatus: 403 }, { user: {} }, { memberships: [] }, { memberships: [{ partner_id: "bad" }] }]) {
    const f = setup(options); assert.ok([401, 403].includes((await f.handler(req())).status));
    assert.ok(f.calls.every(({ url }) => url.origin !== "https://api.airtable.com"));
  }
});
test("partner payouts use enabled RLS membership and verify both Airtable partner links", async () => {
  const f = setup({ records: [record(1, { "Cancelled by email": "internal@pulsefx.test", "Cancellation reason": "Internal review", "Cancelled by user ID": "10000000-0000-4000-8000-000000000001", "Last edited at": "2026-11-14T00:00:00Z", "Created by email": "internal@pulsefx.test", "Created by user ID": "10000000-0000-4000-8000-000000000001" }), record(2, { Partner: [otherId] }), record(3, { "Partner ID": otherId }), record(4, { Partner: [partnerId, otherId] })] });
  const response = await f.handler(req()); assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await response.json()).payouts, [{ id: record(1).id, ref: "PAY-1", client: "Company | client@example.test", amount: 125.5, currency: "CAD", status: "Paid", date: "2026-11-14T15:00:00.000Z", createdAt: "", submissionId: "", bank: null, cancelledAt: "", lastEditedAt: "2026-11-14T00:00:00.000Z" }]);
});
test("query parameters cannot select a different partner for personal history", async () => {
  const f = setup(); assert.equal((await f.handler(req("GET", `?partnerId=${otherId}`))).status, 200);
  assert.equal(f.calls[2].url.searchParams.get("filterByFormula"), `{Partner ID}='${partnerId}'`);
});
test("personal payout history rejects writes and banking routes", async () => {
  const f = setup(); assert.equal((await f.handler(req("POST"))).status, 405); assert.equal(f.calls.length, 1);
  for (const view of ["accounts", "review", "payouts", "admin-payouts"]) {
    const other = setup(); assert.equal((await other.handler(req("GET", `?view=${view}`))).status, 400); assert.equal(other.calls.length, 1);
  }
});
test("ordinary partners and user-editable roles cannot access the administrative payout endpoint", async () => {
  for (const method of ["GET", "POST"]) {
    const f = setup({ user: { id: "partner-user", user_metadata: { role: "partner_admin" } } });
    assert.equal((await f.handler(req(method, "?view=admin"))).status, 403); assert.equal(f.calls.length, 1);
  }
});
test("history has real empty states, newest-first ordering and configured table support", async () => {
  const empty = setup(); assert.deepEqual(await (await empty.handler(req())).json(), { payouts: [] });
  const f = setup({ env: { AIRTABLE_PAYOUTS_TABLE_ID: "tblPayouts" }, records: [record(1, { "Paid at": "2026-10-01T12:00:00Z" }), record(2)] });
  assert.deepEqual((await (await f.handler(req("GET", "?view=history"))).json()).payouts.map((row) => row.ref), ["PAY-2", "PAY-1"]);
});
test("history pagination keeps ownership checks and rejects repeated offsets", async () => {
  const f = setup({ page: (url) => url.searchParams.has("offset") ? { records: [record(2), record(3, { Partner: [otherId] })] } : { records: [record(1)], offset: "next" } });
  assert.equal((await (await f.handler(req())).json()).payouts.length, 2);
  const repeated = setup({ page: () => ({ records: [], offset: "same" }) }); assert.equal((await repeated.handler(req())).status, 502);
});
test("membership and Airtable failures stay closed and never expose provider secrets", async () => {
  for (const options of [{ membershipFailure: true }, { failure: true }, { authStatus: 500 }]) {
    const f = setup(options); const response = await f.handler(req()); assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /private-token/);
  }
});


test("partner history includes original creation timestamps without internal author information", async () => {
  const first = record(1, { "Created at": "2026-11-01T14:15:16Z", "Created by email": "internal@pulsefx.test" });
  first.createdTime = "2026-10-01T00:00:00Z";
  const second = record(2); second.createdTime = "2026-10-02T10:20:30Z";
  const { handler } = setup({ records: [first, second] });
  const body = await (await handler(req())).json();
  assert.equal(body.payouts.find((row) => row.ref === "PAY-1").createdAt, "2026-11-01T14:15:16.000Z");
  assert.equal(body.payouts.find((row) => row.ref === "PAY-2").createdAt, "2026-10-02T10:20:30.000Z");
  assert.equal(JSON.stringify(body).includes("internal@pulsefx.test"), false);
});

test("customer payout details resolve the original account, never the current account or another partner", async () => {
 const submissionId=`${partnerId}:original`;
 const bank={id:"recCCCCCCCCCCCCCC",fields:{Partner:[partnerId],"Partner ID":partnerId,"Submission ID":submissionId,"Account number":"0012345678","Institution name":"Historical Bank","Account holder":"Holder",Currency:"CAD","Current account":false}};
 const records=[record(1,{"Bank Submission ID":submissionId}),record(2,{Status:"Cancelled","Cancelled at":"2026-11-14T15:00:00Z","Cancellation reason":"Duplicate","Show cancellation reason to partner":true, "Cancelled by email":"private@pulsefx.test"}),record(3,{"Bank Submission ID":"foreign"})];
 const current={...bank,fields:{...bank.fields,"Submission ID":"current","Current account":true,"Account number":"9999999999"}};
 const foreign={...bank,fields:{...bank.fields,"Submission ID":"foreign","Partner ID":otherId,Partner:[otherId],"Account number":"8888888888"}};
 const f=setup({records,banks:[bank,current,foreign]});const body=await(await f.handler(req())).json();
 assert.equal(body.payouts[0].bank.account,"0012345678");assert.equal(body.payouts[1].cancelledAt,"2026-11-14T15:00:00.000Z");assert.equal(body.payouts[1].cancellationReason,"Duplicate");assert.equal(body.payouts[1].bank,null);assert.equal(body.payouts[2].bank,null);
 assert.doesNotMatch(JSON.stringify(body),/9999999999|8888888888|private@pulsefx/);
 const legacy=setup({records:[record(1)],banks:[current]});const old=await(await legacy.handler(req())).json();assert.equal(old.payouts[0].bank,null);
});
test("account pagination remains partner-scoped and rejects repeated cursors", async () => {
 const f=setup({records:[record(1,{"Bank Submission ID":"original"})],bankPage:()=>({records:[],offset:"repeat"})});
 assert.equal((await f.handler(req())).status,502);
});

test("legacy account references resolve by bank record ID with partner ownership checks", async () => {
 const bank={id:"recCCCCCCCCCCCCCC",fields:{Partner:[partnerId],"Partner ID":partnerId,"Account number":"0012345678",Currency:"CAD"}};
 const reference=`airtable:${bank.id}`;
 const f=setup({records:[record(1,{"Bank Submission ID":reference})],banks:[bank]});
 assert.equal((await(await f.handler(req())).json()).payouts[0].bank.account,"0012345678");
 const foreign=setup({records:[record(1,{"Bank Submission ID":reference})],banks:[{...bank,fields:{...bank.fields,Partner:[otherId]}}]});
 assert.equal((await(await foreign.handler(req())).json()).payouts[0].bank,null);
});

test("customer API never returns hidden notes or cancellation reasons, even when text exists", async () => {
 const records=[record(1,{Notes:"PRIVATE NOTES","Cancellation reason":"PRIVATE REASON"}),record(2,{Notes:"Shared note","Cancellation reason":"Shared reason","Show notes to partner":true,"Show cancellation reason to partner":true}),record(3,{Notes:"BAD FLAG","Show notes to partner":"true"})];
 const body=await(await setup({records}).handler(req())).json();
 assert.equal(Object.hasOwn(body.payouts[0],"notes"),false);assert.equal(Object.hasOwn(body.payouts[0],"cancellationReason"),false);
 assert.equal(body.payouts[1].notes,"Shared note");assert.equal(body.payouts[1].cancellationReason,"Shared reason");
 assert.equal(Object.hasOwn(body.payouts[2],"notes"),false);assert.doesNotMatch(JSON.stringify(body),/PRIVATE|BAD FLAG/);
});
