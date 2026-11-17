import test from "node:test";
import assert from "node:assert/strict";
import { createAdminDashboardHandler } from "./service.mjs";
const partnerId = "recAAAAAAAAAAAAAA";
const referralId = "recBBBBBBBBBBBBBB";
const userId = "10000000-0000-4000-8000-000000000001";
const bearer = `header.${Buffer.from(JSON.stringify({ session_id: "30000000-0000-4000-8000-000000000001" })).toString("base64url")}.signature`;
function setup({ role = "partner_admin", revoked = false, method = "GET", repeatedOffset = false, authorization = `Bearer ${bearer}`, invalidUser = false, upstreamFailure = false, registrationFailure = false } = {}) {
  const calls = [];
  const rows = {
    Partners_api: [{ id: partnerId, fields: { Name: "Company", Referrals: [referralId] } }],
    Referrals_api: [{ id: referralId, createdTime: "2026-11-01T16:00:00Z", fields: { Company: "Client", Partner: [partnerId], Status: "Onboarded", Currencies: ["CAD"] } }, { id: "recCCCCCCCCCCCCCC", fields: { Partner: [partnerId] } }],
    Payouts_api: [{ id: "recDDDDDDDDDDDDDD", fields: { Partner: [partnerId], "Partner ID": partnerId, Amount: 25, Status: "Paid", Currency: "CAD", Notes: "Private note" } }],
    Banking_details_api: [{ id: "recEEEEEEEEEEEEEE", fields: { Partner: [partnerId], "Partner ID": partnerId, Status: "Pending verification", "Account number": "123456789", "Account holder": "Private holder" } }],
    Brand_kit_api: [{ id: "recFFFFFFFFFFFFFF", fields: { "Partner Airtable ID": partnerId, "Brand logo": [{ url: "https://private.example/logo" }] } }],
  };
  const rpcCalls = [];
  const handler = createAdminDashboardHandler({
    env: { AIRTABLE_BASE_ID: "appTest", AIRTABLE_TOKEN: "private-token" },
    admin: {
      auth: { getUser: async token => {
        assert.equal(token, bearer);
        return invalidUser ? { error: new Error("private-auth-error") } : { data: { user: { id: userId, app_metadata: { role } } } };
      } },
      rpc: async name => {
        rpcCalls.push(name);
        if (name === "portal_admin_session_valid") return { data: !revoked };
        assert.equal(name, "list_partner_admin_accounts");
        if (registrationFailure) return { error: new Error("private-registration-error") };
        return { data: [{ id: userId, partner_id: partnerId, name: "Ana", email: "ana@example.test", company: "Company", ready: true, activated: true, user_created_at: "2026-11-01T16:00:00Z" }] };
      },
    },
    fetchImpl: async target => {
      if (upstreamFailure) return Response.json({ error: "private-token" }, { status: 403 });
      const url = new URL(target);
      calls.push(url);
      const table = url.pathname.split("/").at(-1);
      const records = rows[table];
      assert.ok(records, `Unexpected table ${table}`);
      return Response.json({ records, ...(repeatedOffset ? { offset: "repeated" } : {}) });
    },
  });
  const request = () => handler(new Request("https://example.test/pulsefx-admin-dashboard", { method, headers: authorization ? { authorization } : {} }));
  return { request, calls, rpcCalls };
}
test("dashboard requires a live administrator session and accepts only reads", async () => {
  for (const [options, status] of [[{ role: "partner" }, 403], [{ revoked: true }, 401], [{ method: "POST" }, 405], [{ method: "DELETE" }, 405], [{ authorization: "" }, 401], [{ invalidUser: true }, 401]]) {
    const fixture = setup(options);
    assert.equal((await fixture.request()).status, status);
    assert.equal(fixture.calls.length, 0);
  }
});
test("dashboard joins setup and activity while withholding banking details and attachments", async () => {
  const fixture = setup();
  const response = await fixture.request();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.partners[0].banking, "Pending verification");
  assert.equal(data.partners[0].brand, "Partial");
  assert.equal(data.partners[0].email, "ana@example.test");
  assert.equal(data.referrals[0].validOwnership, true);
  assert.equal(data.referrals[1].validOwnership, false);
  assert.equal(data.payouts[0].amount, 25);
  const serialized = JSON.stringify(data);
  for (const hidden of ["123456789", "Private holder", "private.example", "Private note", "private-token"]) assert.equal(serialized.includes(hidden), false);
});
test("dashboard pagination rejects repeated offsets without leaking upstream details", async () => {
  const response = await setup({ repeatedOffset: true }).request();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Unable to load dashboard data. Please try again." });
});

test("dashboard preflight and unconfigured requests never read data", async () => {
  const fixture = setup({ method: "OPTIONS", authorization: "" });
  const preflight = await fixture.request();
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.rpcCalls.length, 0);
  const handler = createAdminDashboardHandler({ env: {}, admin: null });
  assert.equal((await handler(new Request("https://example.test", { headers: { authorization: `Bearer ${bearer}` } }))).status, 503);
});
test("dashboard fails closed on source errors and prevents response caching", async () => {
  for (const options of [{ upstreamFailure: true }, { registrationFailure: true }]) {
    const response = await setup(options).request();
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { error: "Unable to load dashboard data. Please try again." });
  }
});
