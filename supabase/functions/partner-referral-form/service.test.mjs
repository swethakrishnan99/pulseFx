import test from "node:test";
import assert from "node:assert/strict";
import { createReferralFormHandler, referralToken, validateSubmission } from "./service.mjs";
import { BUSINESS_INTERESTS } from "../_shared/referral-form-fields.mjs";
const partnerId = "recAAAAAAAAAAAAAA";
const env = { SUPABASE_URL: "https://project.example", SUPABASE_ANON_KEY: "publishable", AIRTABLE_TOKEN: "private", AIRTABLE_BASE_ID: "appTest", AIRTABLE_PARTNERS_TABLE_ID: "partner_api", AIRTABLE_REFERRALS_TABLE_ID: "referrals_api", PORTAL_URL: "https://portal.example/pulseFx/", PARTNER_REFERRAL_LINK_SECRET: "a-test-secret-with-at-least-32-characters" };
const token = await referralToken(partnerId, env.PARTNER_REFERRAL_LINK_SECRET);
const link = `${env.PORTAL_URL}?ref=${token}`;
const submission = { action: "submit", token, submissionId: "1efcc448-4c9c-4f49-a658-13d9b993d841", firstName: " Ana ", lastName: " Costa ", company: "Company", email: " ANA@example.com ", phone: "+1 416 555 0100", interests: [BUSINESS_INTERESTS[0]], website: "" };
const req = (body, auth = false) => new Request("https://edge.example", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer user-token" } : {}) }, body: JSON.stringify(body) });
function setup(options = {}) {
  const calls = [], writes = [], claims = [];
  const admin = {
    from: name => { assert.equal(name, "partner_memberships"); const q = { select: () => q, eq: () => q, limit: async () => ({ data: options.disabled ? [] : [{ partner_id: partnerId }], error: options.membershipError || null }) }; return q; },
    rpc: async (name, body) => { assert.equal(name, "claim_partner_referral_submission"); claims.push(body); return { data: options.claim || "accepted", error: options.claimError || null }; },
  };
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input); calls.push(url.href);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "user-1", ...(options.banned ? { banned_until: "2099-01-01" } : {}) }, { status: options.authFailure ? 401 : 200 });
    if (url.pathname === "/rest/v1/partner_memberships") return Response.json(options.noMembership ? [] : [{ partner_id: partnerId }]);
    assert.equal(init.headers.Authorization, "Bearer private");
    if (url.pathname.endsWith(`/partner_api/${partnerId}`)) {
      if (init.method === "PATCH") { writes.push(JSON.parse(init.body)); return Response.json({ id: partnerId }); }
      return Response.json({ id: partnerId, fields: { Name: "Partner One", "Referral URL": options.storedLink ?? link, Referrals: options.existing ? ["recDDDDDDDDDDDDDD"] : [] } });
    }
    if (url.pathname === "/v0/appTest/referrals_form_api") {
      writes.push(JSON.parse(init.body));
      if (options.intakeFailure) throw new Error("private intake error");
      return Response.json({ records: [{ id: "recCCCCCCCCCCCCCC" }] });
    }
    if (url.pathname === "/v0/appTest/referrals_api" && !init.method) {
      if (options.lookupFailure) throw new Error("Lookup unavailable");
      return Response.json({ records: [{ id: "recDDDDDDDDDDDDDD", fields: { Partner: [options.foreign ? "recEEEEEEEEEEEEEE" : partnerId], Email: options.existing, Status: options.existingStatus || "Invited" } }] });
    }
    assert.equal(url.pathname, "/v0/appTest/referrals_api");
    writes.push(JSON.parse(init.body));
    if (options.saveFailure) throw new Error("private upstream error");
    return Response.json({ records: [{ id: "recBBBBBBBBBBBBBB" }] });
  };
  return { handler: createReferralFormHandler({ env: { ...env, ...options.env }, admin, fetchImpl }), calls, writes, claims };
}
test("signed tokens are stable per partner and distinct across partners", async () => {
  assert.equal(await referralToken(partnerId, env.PARTNER_REFERRAL_LINK_SECRET), token);
  assert.notEqual(await referralToken("recBBBBBBBBBBBBBB", env.PARTNER_REFERRAL_LINK_SECRET), token);
});
test("only authenticated membership can create and persist a link", async () => {
  const s = setup({ storedLink: "" });
  assert.equal((await s.handler(req({ action: "link" }))).status, 401);
  const response = await s.handler(req({ action: "link" }, true));
  assert.equal(response.status, 200); assert.equal((await response.json()).url, link);
  assert.deepEqual(s.writes, [{ fields: { "Referral URL": link } }]);
  for (const options of [{ authFailure: true }, { noMembership: true }, { banned: true }]) {
    const next = setup(options); assert.ok((await next.handler(req({ action: "link" }, true))).status >= 400); assert.equal(next.writes.length, 0);
  }
});
test("public load returns only the partner name and rejects invalid/tampered/revoked links", async () => {
  const s = setup(); const response = await s.handler(req({ action: "load", token }));
  assert.deepEqual(await response.json(), { partner: { name: "Partner One" } });
  for (const body of [{ action: "load", token: `${token.slice(0,-1)}z` }, { action: "load", token: "abc" }, { action: "load", token, partnerId: "other" }]) assert.ok((await s.handler(req(body))).status >= 400);
  for (const options of [{ disabled: true }, { storedLink: "https://other.example" }, { membershipError: true }]) assert.ok((await setup(options).handler(req({ action: "load", token }))).status >= 400);
  assert.equal(s.writes.length, 0);
});
test("public submission derives partner, contact, source and status on the server", async () => {
  const s = setup(); const response = await s.handler(req(submission));
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), { submitted: true });
  assert.deepEqual(s.writes[0].records[0].fields, { Partner: [partnerId], Company: "Company", Email: "ana@example.com", "First name": "Ana", "Last name": "Costa", Phone: submission.phone, "Business interests": submission.interests, "Submission ID": submission.submissionId });
  assert.deepEqual(s.writes[1].records[0].fields, { Partner: [partnerId], Company: "Company", Contact: "Ana Costa", Email: "ana@example.com", Source: "Referral Link", Status: "Invited", "Referral submissions": ["recCCCCCCCCCCCCCC"] });
  assert.equal(s.claims[0].p_partner_id, partnerId); assert.match(s.claims[0].p_client_hash, /^[a-f0-9]{64}$/);
});
test("validation rejects forged source/partner/status, invalid fields and honeypot before writing", async () => {
  for (const extra of [{ Source: "Partner Portal" }, { partnerId: "other" }, { status: "Onboarded" }, { firstName: " " }, { email: "bad" }, { interests: ["unknown"] }, { interests: [BUSINESS_INTERESTS[0], BUSINESS_INTERESTS[0]] }, { website: "spam" }, { submissionId: "invalid" }]) {
    const s = setup(); assert.equal((await s.handler(req({ ...submission, ...extra }))).status, 400); assert.equal(s.writes.length, 0); assert.equal(s.claims.length, 0);
  }
  assert.ok(validateSubmission({ ...submission, company: "", phone: "", interests: [] }));
});
test("durable duplicate and rate guards prevent writes; gate outages fail closed", async () => {
  for (const [options, status] of [[{ claim: "duplicate" }, 409], [{ claim: "limited" }, 429], [{ claimError: true }, 502]]) {
    const s = setup(options); assert.equal((await s.handler(req(submission))).status, status); assert.equal(s.writes.length, 0);
  }
});
test("uncertain saves never claim success or expose upstream secrets", async () => {
  const s = setup({ saveFailure: true }); const response = await s.handler(req(submission));
  assert.equal(response.status, 502); const body = await response.text(); assert.match(body, /could not confirm/); assert.ok(!body.includes("private"));
});
test("preflight, method, bounded body and missing config", async () => {
  const s = setup(); assert.equal((await s.handler(new Request("https://edge.example", { method: "OPTIONS" }))).status, 204);
  assert.equal((await s.handler(new Request("https://edge.example"))).status, 405);
  assert.equal((await s.handler(req({ action: "load", token, padding: "x".repeat(9000) }))).status, 413);
  assert.equal((await setup({ env: { PARTNER_REFERRAL_LINK_SECRET: "" } }).handler(req(submission))).status, 503);
});

test("a failed intake never creates a referral; a failed referral retains its intake", async () => {
  const intake = setup({ intakeFailure: true });
  assert.equal((await intake.handler(req(submission))).status, 502);
  assert.equal(intake.writes.length, 1);
  assert.ok(!intake.calls.some(url => url.endsWith("/referrals_api")));
  const referral = setup({ saveFailure: true });
  assert.equal((await referral.handler(req(submission))).status, 502);
  assert.equal(referral.writes.length, 2);
  assert.ok(referral.writes[0].records[0].fields["Submission ID"]);
});

test("fresh submissions cannot duplicate an existing email for this partner", async () => {
  for (const existingStatus of ["Invited", "Account created", "Documents submitted", "Under review", "Onboarded", "Rejected"]) {
    const s = setup({ existing: " ANA@EXAMPLE.COM ", existingStatus });
    assert.equal((await s.handler(req(submission))).status, 409);
    assert.equal(s.writes.length, 0);
  }
});
test("same company with a different email and emails linked only to another partner are allowed", async () => {
  for (const options of [{ existing: "other@example.com" }, { existing: "ana@example.com", foreign: true }]) {
    const s = setup(options); assert.equal((await s.handler(req(submission))).status, 201);
  }
});
test("unavailable duplicate lookup cannot create intake or referral records", async () => {
  const s = setup({ existing: "ana@example.com", lookupFailure: true });
  assert.equal((await s.handler(req(submission))).status, 502);
  assert.equal(s.writes.length, 0);
});

test("a rejected referral requires current confirmation; active duplicates cannot be overridden", async () => {
  const s = setup({ existing: "ana@example.com", existingStatus: "Rejected" });
  const first = await s.handler(req(submission)); const body = await first.json();
  assert.equal(first.status, 409); assert.equal(body.code, "rejection_confirmation_required");
  assert.equal(s.claims.length, 0); assert.equal(s.writes.length, 0);
  const stale = await s.handler(req({ ...submission, confirmedRejection: { ...body.rejection, statusChangedAt: "stale" } }));
  assert.equal(stale.status, 409);
  const confirmed = await s.handler(req({ ...submission, confirmedRejection: body.rejection }));
  assert.equal(confirmed.status, 201);
  const active = setup({ existing: "ana@example.com", existingStatus: "Onboarded" });
  assert.equal((await active.handler(req({ ...submission, confirmedRejection: body.rejection }))).status, 409);
  assert.equal(active.writes.length, 0);
});
