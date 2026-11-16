import test from "node:test";
import assert from "node:assert/strict";
import { createOnePagersHandler } from "./service.mjs";
const env = { SUPABASE_URL: "https://project.test", SUPABASE_ANON_KEY: "anon", AIRTABLE_TOKEN: "secret", AIRTABLE_BASE_ID: "app123", AIRTABLE_ONE_PAGERS_TABLE_ID: "tblAssets" };
function setup(member = true, authStatus = 200) {
  const calls = [];
  const handler = createOnePagersHandler({ env, fetchImpl: async url => {
    url = String(url); calls.push(url);
    if (url.includes("/auth/v1/user")) return Response.json({ id: "user-1" }, { status: authStatus });
    if (url.includes("partner_memberships")) return Response.json(member ? [{ partner_id: "rec12345678901234" }] : []);
    return Response.json({ records: [{ id: "recAsset", fields: { "Visible to partner": true, Name: "Overview", File: [{ filename: "overview.pdf", url: "https://files.test/logo" }] } }] });
  } });
  return { handler, calls };
}
const request = () => new Request("https://function.test", { method: "POST", headers: { Authorization: "Bearer session" } });
test("requires authentication before accessing Airtable", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(new Request("https://function.test", { method: "POST" }))).status, 401);
  assert.equal(calls.length, 0);
});
test("rejects expired sessions and inactive memberships", async () => {
  for (const [member, status, expected] of [[true, 401, 401], [false, 200, 403]]) {
    const { handler, calls } = setup(member, status);
    assert.equal((await handler(request())).status, expected);
    assert.equal(calls.some(url => url.includes("airtable.com")), false);
  }
});
test("serves assets from the dedicated endpoint for active partners", async () => {
  const { handler } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).onePagers[0].name, "Overview");
});
