import test from "node:test";
import assert from "node:assert/strict";
import { readReferralSubmission } from "./submission.mjs";
const partner = "recAAAAAAAAAAAAAA", other = "recZZZZZZZZZZZZZZ", referral = "recBBBBBBBBBBBBBB", form = "recCCCCCCCCCCCCCC";
function setup(options = {}) {
  const calls = [];
  const request = new Request(`https://edge.example?view=submission&id=${options.id || referral}`, { headers: { authorization: "Bearer token" } });
  const env = { SUPABASE_URL: "https://supabase.example", SUPABASE_ANON_KEY: "public", AIRTABLE_TOKEN: "private", AIRTABLE_BASE_ID: "appTest", AIRTABLE_REFERRALS_TABLE_ID: "referrals_api" };
  const fetchImpl = async input => {
    const url = new URL(input); calls.push(url.pathname);
    if (url.pathname === "/rest/v1/partner_memberships") return Response.json(options.disabled ? [] : [{ partner_id: partner }]);
    if (url.pathname.endsWith(`/referrals_api/${referral}`)) return Response.json({ id: referral, fields: { Partner: [options.foreign ? other : partner], "Referral submissions": options.empty ? [] : [form] } });
    assert.ok(url.pathname.endsWith(`/referrals_form_api/${form}`));
    return Response.json({ id: form, fields: { Partner: [options.mismatchPartner ? other : partner], Referral: [options.mismatchReferral ? other : referral], "First name": "Ana", "Last name": "Costa", Phone: "123", "Business interests": ["Interest"], "Submission ID": "private-id", Email: "private-snapshot@example.com" } });
  };
  return { calls, run: () => readReferralSubmission({ request, env, user: options.admin ? { id: "user", app_metadata: { role: "partner_admin" } } : { id: "user" }, admin: null, fetchImpl, json: (body, status = 200) => Response.json(body, { status }) }) };
}
test("partner can read only the minimal details of its linked form", async () => {
  const response = await setup().run(); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { submission: { firstName: "Ana", lastName: "Costa", phone: "123", interests: ["Interest"] } });
});
test("foreign, disabled and unverified admin sessions cannot access form data", async () => {
  for (const [options, status] of [[{ foreign: true }, 404], [{ disabled: true }, 403], [{ admin: true }, 401]]) {
    const s = setup(options); assert.equal((await s.run()).status, status); assert.ok(!s.calls.some(path => path.includes("referrals_form_api")));
  }
});
test("mismatched reciprocal links or partners never expose intake data", async () => {
  for (const options of [{ mismatchPartner: true }, { mismatchReferral: true }]) assert.equal((await setup(options).run()).status, 502);
});
test("existing referrals without forms still work and malformed IDs are rejected", async () => {
  assert.deepEqual(await (await setup({ empty: true }).run()).json(), { submission: null });
  const s = setup({ id: "invalid" }); assert.equal((await s.run()).status, 400); assert.equal(s.calls.length, 0);
});
