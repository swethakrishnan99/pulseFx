import assert from "node:assert/strict";
import test from "node:test";
import { createReferralsHandler } from "./service.mjs";

const partnerId = "rec" + "A".repeat(14);
const otherPartnerId = "rec" + "B".repeat(14);
const referralId = (index) => "rec" + String(index).padStart(14, "0");
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "public-test-key",
  AIRTABLE_TOKEN: "private-airtable-test-token",
  AIRTABLE_BASE_ID: "appTest",
  AIRTABLE_REFERRALS_TABLE_ID: "tblReferrals",
};
const referral = (index, overrides = {}) => ({
  id: referralId(index),
  createdTime: "2026-11-07T18:00:00.000Z",
  fields: {
    Company: "Northwind Machining Ltd.", Partner: [partnerId],
    Contact: "Ana Costa", Email: "ana@northwind.example", Country: "Canada",
    Status: "Documents submitted", Created: "2026-11-07T18:00:00.000Z",
    "Last modified": "2026-11-08T19:30:00.000Z", ...overrides,
  },
});
const request = (suffix = "", options = {}) => new Request(`https://example.supabase.co/functions/v1/referrals${suffix}`, {
  headers: { Authorization: "Bearer user-token" }, ...options,
});

function setup(options = {}) {
  const calls = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    if (url.origin === env.SUPABASE_URL) {
      assert.equal(init.headers.apikey, env.SUPABASE_ANON_KEY);
      assert.equal(init.headers.Authorization || init.headers.authorization, "Bearer user-token");
      if (url.pathname === "/auth/v1/user") {
        return options.authResponse || Response.json({ id: "user-a" });
      }
      assert.equal(url.pathname, "/rest/v1/partner_memberships");
      assert.equal(url.searchParams.get("user_id"), "eq.user-a");
      return options.membershipResponse || Response.json(options.memberships ?? [{ partner_id: partnerId }]);
    }
    assert.equal(url.origin, "https://api.airtable.com");
    assert.equal(init.headers.Authorization, `Bearer ${env.AIRTABLE_TOKEN}`);
    if (options.airtableError) return Response.json({ error: env.AIRTABLE_TOKEN }, { status: options.airtableError });
    if (url.pathname === `/v0/appTest/Partners/${partnerId}`) {
      return Response.json(options.partner ?? { id: partnerId, fields: { Referrals: [referralId(1)] } });
    }
    assert.equal(url.pathname, "/v0/appTest/tblReferrals");
    assert.ok(url.searchParams.getAll("fields[]").includes("Partner"));
    if (options.page) return Response.json(options.page(url));
    return Response.json({ records: options.records ?? [referral(1)] });
  };
  return { calls, fetchImpl, handler: createReferralsHandler({ env: { ...env, ...options.env }, fetchImpl }) };
}

test("validates the session and membership, then returns normalized partner referrals", async () => {
  const { calls, handler } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { referrals: [{
    id: referralId(1), company: "Northwind Machining Ltd.", contact: "Ana Costa",
    email: "ana@northwind.example", country: "Canada", status: "Documents submitted",
    created: "2026-11-07", modified: "2026-11-08", createdAt: "2026-11-07T18:00:00.000Z", modifiedAt: "2026-11-08T19:30:00.000Z", volume: "", cur: [], otherCur: "", notes: "",
  }] });
  assert.equal(calls.length, 4);
  assert.equal(calls[3].url.searchParams.get("filterByFormula"), `OR(RECORD_ID()='${referralId(1)}')`);
});

test("preflight succeeds without auth or upstream requests", async () => {
  const { handler, calls } = setup();
  const response = await handler(request("", { method: "OPTIONS", headers: {} }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(response.headers.get("Access-Control-Allow-Headers"), /authorization/);
  assert.equal(calls.length, 0);
});

test("rejects unsupported methods and requests without a bearer token before querying upstream", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request("", { method: "DELETE" }))).status, 405);
  assert.equal((await handler(request("", { headers: {} }))).status, 401);
  assert.equal((await handler(request("", { headers: { Authorization: "Basic user-token" } }))).status, 401);
  assert.equal(calls.length, 0);
});

test("expired sessions cannot query memberships or Airtable", async () => {
  const { handler, calls } = setup({ authResponse: Response.json({ error: "expired" }, { status: 401 }) });
  assert.equal((await handler(request())).status, 401);
  assert.equal(calls.length, 1);
});

test("accounts without membership cannot query Airtable", async () => {
  const { handler, calls } = setup({ memberships: [] });
  assert.equal((await handler(request())).status, 403);
  assert.equal(calls.length, 2);
});

test("provisional partner IDs cannot query Airtable", async () => {
  const { handler, calls } = setup({ memberships: [{ partner_id: "pilot-a" }] });
  assert.equal((await handler(request())).status, 403);
  assert.equal(calls.length, 2);
});

test("membership lookup failures fail closed", async () => {
  const { handler, calls } = setup({ membershipResponse: Response.json({}, { status: 500 }) });
  assert.equal((await handler(request())).status, 502);
  assert.equal(calls.length, 2);
});

test("client-supplied partner IDs cannot override the verified membership", async () => {
  const { handler, calls } = setup();
  const response = await handler(request(`?partner_id=${otherPartnerId}`));
  assert.equal(response.status, 200);
  assert.equal(calls[2].url.pathname, `/v0/appTest/Partners/${partnerId}`);
});

test("excludes records linked to other partners, missing links, or multiple partners", async () => {
  const { handler } = setup({
    partner: { id: partnerId, fields: { Referrals: [1, 2, 3, 4].map(referralId) } },
    records: [referral(1), referral(2, { Partner: [otherPartnerId] }),
      referral(3, { Partner: undefined }), referral(4, { Partner: [partnerId, otherPartnerId] })],
  });
  const body = await (await handler(request())).json();
  assert.deepEqual(body.referrals.map((record) => record.id), [referralId(1)]);
});

test("excludes records absent from the partner's referral links", async () => {
  const { handler } = setup({ records: [referral(1), referral(2)] });
  const body = await (await handler(request())).json();
  assert.deepEqual(body.referrals.map((record) => record.id), [referralId(1)]);
});

test("partners without referrals return an empty list without scanning the table", async () => {
  const { handler, calls } = setup({ partner: { id: partnerId, fields: {} } });
  assert.deepEqual(await (await handler(request())).json(), { referrals: [] });
  assert.equal(calls.length, 3);
});

test("follows pagination while maintaining the partner filter", async () => {
  const { handler, calls } = setup({
    partner: { id: partnerId, fields: { Referrals: [referralId(1), referralId(2)] } },
    page: (url) => url.searchParams.has("offset")
      ? { records: [referral(2)] }
      : { records: [referral(1)], offset: "next-page" },
  });
  const body = await (await handler(request())).json();
  assert.equal(body.referrals.length, 2);
  assert.equal(calls[4].url.searchParams.get("offset"), "next-page");
  assert.equal(calls[3].url.searchParams.get("filterByFormula"), calls[4].url.searchParams.get("filterByFormula"));
});

test("batches large referral lists and deduplicates linked IDs", async () => {
  const ids = Array.from({ length: 52 }, (_, index) => referralId(index));
  const { handler, calls } = setup({
    partner: { id: partnerId, fields: { Referrals: [...ids, ids[0]] } },
    page: (url) => ({ records: [...url.searchParams.get("filterByFormula").matchAll(/rec\d{14}/g)]
      .map(([id]) => referral(Number(id.slice(3)))) }),
  });
  const body = await (await handler(request())).json();
  assert.equal(body.referrals.length, 52);
  assert.equal(calls.length, 5);
});

test("missing optional fields and timestamps are handled without inventing statuses", async () => {
  const { handler } = setup({ records: [{ id: referralId(1), createdTime: "2026-11-07T00:00:00Z", fields: { Partner: [partnerId] } }] });
  const { referrals } = await (await handler(request())).json();
  assert.equal(referrals[0].email, "");
  assert.equal(referrals[0].status, "Unknown");
  assert.equal(referrals[0].created, "2026-11-07");
  assert.equal(referrals[0].modified, "2026-11-07");
  assert.equal(referrals[0].createdAt, "2026-11-07T00:00:00.000Z");
  assert.equal(referrals[0].modifiedAt, "");
});

test("missing configuration is reported without using Airtable", async () => {
  const { handler, calls } = setup({ env: { AIRTABLE_TOKEN: undefined } });
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls.length, 2);
});

test("upstream Airtable errors never expose credentials or partial data", async () => {
  const { handler } = setup({ airtableError: 429 });
  const response = await handler(request());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Unable to load referrals. Please try again." });
});

test("malformed partner links and repeated pagination offsets fail safely", async () => {
  const malformed = setup({ partner: { id: partnerId, fields: { Referrals: ["invalid-record-id"] } } });
  assert.equal((await malformed.handler(request())).status, 502);
  const repeated = setup({ page: () => ({ records: [referral(1)], offset: "same-offset" }) });
  assert.equal((await repeated.handler(request())).status, 502);
});

const clientDetails = (overrides = {}) => ({
  company: "New client", contact: "Client Contact", email: "CONTACT@example.com",
  country: "Canada", volume: "CAD 50,000 to 250,000", cur: ["USD", "Other"],
  otherCur: "JPY, CHF", notes: "Call in the afternoon", ...overrides,
});
function setupWrite(options = {}) {
  const base = setup({ partner: { id: partnerId, fields: {} }, ...options });
  const writes = [];
  const handler = createReferralsHandler({ env, fetchImpl: async (url, init) => {
    if (init.method === "POST") {
      writes.push(JSON.parse(init.body));
      if (options.writeError) return Response.json({ error: env.AIRTABLE_TOKEN }, { status: 422 });
      const fields = JSON.parse(init.body).records[0].fields;
      return Response.json({ records: [referral(2, fields)] });
    }
    // Reuse the authenticated GET mock's upstream behavior via the exposed fetch implementation.
    return base.fetchImpl(url, init);
  } });
  return { handler, writes, calls: base.calls };
}
const post = (body) => request("", { method: "POST", headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("creates a referral with all form fields and the verified partner only", async () => {
  const { handler, writes } = setupWrite();
  const response = await handler(post(clientDetails()));
  assert.equal(response.status, 201);
  assert.deepEqual(writes[0], { records: [{ fields: {
    Company: "New client", Contact: "Client Contact", Email: "contact@example.com", Country: "Canada",
    "Expected monthly volume": "CAD 50,000 to 250,000", Currencies: ["USD", "Other"],
    "Other currency": "JPY, CHF", Notes: "Call in the afternoon", Partner: [partnerId], Status: "Invited",
  } }] });
  const { referral: saved } = await response.json();
  assert.equal(saved.otherCur, "JPY, CHF");
  assert.equal(saved.notes, "Call in the afternoon");
  assert.equal(saved.volume, "CAD 50,000 to 250,000");
  assert.deepEqual(saved.cur, ["USD", "Other"]);
  assert.equal(writes[0].records[0].fields.Created, undefined);
});

test("invalid fields and caller-assigned partner/status never write to Airtable", async () => {
  for (const overrides of [
    { company: " " }, { contact: "" }, { email: "invalid" }, { country: "Unknown" },
    { volume: "Unlimited" }, { cur: [] }, { cur: ["INVALID"] }, { cur: ["CAD", "CAD"] },
    { otherCur: "" }, { otherCur: "x".repeat(61) }, { notes: "x".repeat(5001) },
    { partnerId: otherPartnerId }, { status: "Onboarded" }, { company: 1 },
  ]) {
    const { handler, writes } = setupWrite();
    assert.equal((await handler(post(clientDetails(overrides)))).status, 400, JSON.stringify(overrides).slice(0,100));
    assert.equal(writes.length, 0);
  }
});

test("malformed/oversized bodies never write", async () => {
  const { handler, writes } = setupWrite();
  assert.equal((await handler(request("", { method: "POST", body: "{" }))).status, 400);
  assert.equal((await handler(post({ notes: "x".repeat(17000) }))).status, 413);
  assert.equal(writes.length, 0);
});

test("unauthenticated, expired, disabled or unlinked users cannot create referrals", async () => {
  for (const options of [{ authResponse: Response.json({}, { status: 401 }) }, { memberships: [] }, { memberships: [{ partner_id: "invalid" }] }]) {
    const { handler, writes } = setupWrite(options);
    assert.ok([401,403].includes((await handler(post(clientDetails()))).status));
    assert.equal(writes.length, 0);
  }
  const { handler, writes } = setupWrite();
  assert.equal((await handler(request("", { method: "POST", headers: {}, body: "{}" }))).status, 401);
  assert.equal(writes.length, 0);
});

test("optional notes can be empty and hidden other-currency text is discarded", async () => {
  const { handler, writes } = setupWrite();
  assert.equal((await handler(post(clientDetails({ cur: ["CAD"], notes: "", otherCur: "old hidden text" })))).status, 201);
  assert.equal(writes[0].records[0].fields["Other currency"], "");
});

test("duplicate company names are rejected within the authenticated partner", async () => {
  const { handler, writes } = setupWrite({ partner: { id: partnerId, fields: { Referrals: [referralId(1)] } } });
  assert.equal((await handler(post(clientDetails({ company: "  NORTHWIND MACHINING LTD. " })))).status, 409);
  assert.equal(writes.length, 0);
});

test("write failures return a safe message without claiming a successful save", async () => {
  const { handler } = setupWrite({ writeError: true });
  const response = await handler(post(clientDetails()));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Unable to confirm the client was saved. Check Referrals before trying again." });
});
