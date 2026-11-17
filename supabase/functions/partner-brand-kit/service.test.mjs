import test from "node:test";
import assert from "node:assert/strict";
import { createBrandKitHandler } from "./service.mjs";
const partner = "rec12345678901234";
const brandRecord = "rec98765432109876";
const env = { SUPABASE_URL: "https://project.test", SUPABASE_ANON_KEY: "anon", AIRTABLE_TOKEN: "secret", AIRTABLE_BASE_ID: "app123" };
function setup({ membership = partner, uploadFails = false, exists = true, timestamps = {} } = {}) {
  const calls = [];
  let record = { fields: { "Brand logo": [{ filename: "old.png", url: "https://files.test/old", size: 10 }], "Brand description": "Saved description", ...timestamps } };
  const handler = createBrandKitHandler({ env, fetchImpl: async (url, options) => {
    url = String(url); calls.push({ url, ...options });
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-1" });
    if (url.includes("partner_memberships")) return Response.json(membership ? [{ partner_id: membership }] : []);
    if (url.includes("uploadAttachment")) {
      if (uploadFails) return new Response(null, { status: 500 });
      return Response.json({ fields: { fldStaging: [{ id: "attNew", filename: JSON.parse(options.body).filename, url: "https://files.test/new" }] } });
    }
    if (url.includes("filterByFormula")) return Response.json({ records: exists ? [{ id: brandRecord }] : [] });
    if (options.method === "PATCH" && JSON.parse(options.body).performUpsert) return Response.json({ records: [{ id: brandRecord }] });
    if (options.method === "PATCH") { record = { fields: { ...record.fields, ...JSON.parse(options.body).fields } }; return Response.json(record); }
    return Response.json(record);
  } });
  const request = body => handler(new Request("https://function.test", { method: "POST", headers: { Authorization: "Bearer session" }, body: JSON.stringify(body) }));
  return { request, calls };
}
const image = { action: "upload", kind: "logo", filename: "new.png", contentType: "image/png", file: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=" };
test("loads stored description and current asset", async () => {
  const { request } = setup();
  const response = await request({ action: "load" });
  assert.equal(response.status, 200);
  const { kit } = await response.json();
  assert.equal(kit.description, "Saved description");
  assert.equal(kit.logo.name, "old.png");
});
test("replacement writes only the new attachment and clears staging", async () => {
  const { request, calls } = setup();
  assert.equal((await request(image)).status, 200);
  const writes = calls.filter(call => call.method === "PATCH");
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0].body).fields, { "Brand logo": [{ url: "https://files.test/new", filename: "new.png" }], "Brand upload staging": [], "Partner Airtable ID": partner, "Supabase user ID": "user-1" });
  assert.ok(writes[0].url.endsWith(brandRecord));
});
test("failed upload preserves the current attachment", async () => {
  const { request, calls } = setup({ uploadFails: true });
  assert.equal((await request(image)).status, 502);
  assert.equal(calls.filter(call => call.method === "PATCH").length, 0);
});
test("rejects unlinked users before accessing Airtable", async () => {
  const { request, calls } = setup({ membership: null });
  assert.equal((await request(image)).status, 403);
  assert.equal(calls.some(call => call.url.includes("airtable.com")), false);
});
test("validates file and description limits server-side", async () => {
  const { request, calls } = setup();
  assert.equal((await request({ ...image, contentType: "text/html" })).status, 400);
  assert.equal((await request({ action: "description", description: "a".repeat(501) })).status, 400);
  assert.equal(calls.some(call => call.url.includes("airtable.com")), false);
});
test("description save persists verified identities alongside the description", async () => {
  const { request, calls } = setup();
  assert.equal((await request({ action: "description", description: "  Updated  " })).status, 200);
  assert.deepEqual(JSON.parse(calls.find(call => call.method === "PATCH").body), { fields: { "Brand description": "Updated", "Partner Airtable ID": partner, "Supabase user ID": "user-1" } });
});

test("new partner load is empty and does not create a record", async () => {
  const { request, calls } = setup({ exists: false });
  const response = await request({ action: "load" });
  assert.deepEqual((await response.json()).kit, { logo: null, headshot: null, description: "", createdAt: null, updatedAt: null });
  assert.equal(calls.some(call => call.method === "PATCH"), false);
});
test("first save upserts a dedicated brand record using verified partner identity", async () => {
  const { request, calls } = setup({ exists: false });
  assert.equal((await request({ action: "description", description: "New" })).status, 200);
  const writes = calls.filter(call => call.method === "PATCH");
  assert.deepEqual(JSON.parse(writes[0].body), { performUpsert: { fieldsToMergeOn: ["Partner Airtable ID"] }, records: [{ fields: { "Partner Airtable ID": partner, "Supabase user ID": "user-1" } }] });
  assert.ok(writes[0].url.endsWith("Brand_kit_api"));
  assert.ok(writes[1].url.endsWith(brandRecord));
  assert.equal(calls.some(call => call.url.includes("Partners_api")), false);
});

test("browser-supplied identities cannot override authenticated partner and user", async () => {
  const { request, calls } = setup();
  assert.equal((await request({ ...image, "Partner Airtable ID": "recUntrusted12345", "Supabase user ID": "forged-user" })).status, 200);
  const fields = JSON.parse(calls.find(call => call.method === "PATCH").body).fields;
  assert.equal(fields["Partner Airtable ID"], partner);
  assert.equal(fields["Supabase user ID"], "user-1");
});

test("rejects a non-image disguised with an image MIME type before Airtable access", async () => {
  const { request, calls } = setup();
  assert.equal((await request({ ...image, file: btoa("<html>not an image</html>") })).status, 400);
  assert.equal(calls.some(call => call.url.includes("airtable.com")), false);
});

test("returns Airtable timestamps for the kit and each current asset", async () => {
  const timestamps = {
    "Created at": "2026-11-16T12:00:00.000Z", "Updated at": "2026-11-16T14:00:00.000Z",
    "Logo uploaded at": "2026-11-16T13:00:00.000Z", "Headshot uploaded at": "2026-11-16T13:30:00.000Z",
    "Brand headshot": [{ filename: "headshot.jpg", url: "https://files.test/headshot", size: 20 }],
  };
  const { request, calls } = setup({ timestamps });
  const { kit } = await (await request({ action: "load" })).json();
  assert.equal(kit.createdAt, timestamps["Created at"]);
  assert.equal(kit.updatedAt, timestamps["Updated at"]);
  assert.equal(kit.logo.uploadedAt, timestamps["Logo uploaded at"]);
  assert.equal(kit.headshot.uploadedAt, timestamps["Headshot uploaded at"]);
  assert.equal(calls.some(call => call.method === "PATCH"), false);
});
test("missing timestamp fields are returned as null for existing kits", async () => {
  const { request } = setup();
  const { kit } = await (await request({ action: "load" })).json();
  assert.equal(kit.createdAt, null);
  assert.equal(kit.updatedAt, null);
  assert.equal(kit.logo.uploadedAt, null);
});
