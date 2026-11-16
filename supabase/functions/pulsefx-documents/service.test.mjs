import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentsHandler, boundedBody, documentView } from "./service.mjs";
const id = "rec12345678901234";
const actor = { id: "8a1aa698-7d3c-4619-b347-675709f5fdfa", email: "admin@example.test", app_metadata: { role: "partner_admin" } };
const env = { AIRTABLE_TOKEN: "private-secret", AIRTABLE_BASE_ID: "appTest", AIRTABLE_BRAND_ASSETS_TABLE_ID: "tblBrand", AIRTABLE_ONE_PAGERS_TABLE_ID: "tblGuide" };
const file = { id: "attOld", filename: "old.pdf", url: "https://files.test/old", type: "application/pdf" };
const original = { id, fields: { Name: "Original", File: [file], "Visible to partner": true, "Created by user ID": "original-creator", "Created by email": "original@example.test", "Replaced at": "2026-11-01T12:00:00.000Z" } };
const expected = { name: "Original", filename: "old.pdf", fileId: "attOld", visible: true, replacedAt: "2026-11-01T12:00:00.000Z" };
const upload = { filename: "new.pdf", file: btoa("%PDF-1.7\nnew file") };
function setup(options = {}) {
  const calls = [], storageCalls = [], rows = [structuredClone(original)];
  const admin = {
    auth: { getUser: async () => options.expired ? { error: true } : { data: { user: options.actor || actor } } },
    storage: {
      getBucket: async () => ({ data: { public: false } }),
      from: () => ({
        upload: async (...args) => { storageCalls.push(["upload", ...args]); return options.uploadFailure ? { error: true } : { data: {} }; },
        createSignedUrl: async () => ({ data: { signedUrl: "https://staging.test/signed" } }),
        remove: async (...args) => { storageCalls.push(["remove", ...args]); return { data: {} }; },
      }),
    },
  };
  const handler = createDocumentsHandler({ env, admin, verifySession: async () => !options.invalidSession, now: () => new Date("2026-11-16T15:30:00Z"), fetchImpl: async (url, init) => {
    calls.push({ url: String(url), ...init });
    if (!init.method) {
      if (String(url).endsWith(id)) return Response.json(rows[0]);
      return Response.json({ records: rows });
    }
    if (options.writeFailure) throw new Error("Network failure after send");
    const { fields } = JSON.parse(init.body);
    const target = init.method === "POST" ? { id: "recNew12345678901", createdTime: "2026-11-16T15:30:00Z", fields: {} } : rows[0];
    Object.assign(target.fields, fields);
    if (fields.File) target.fields.File = [{ ...file, id: "attNew", filename: fields.File[0].filename, url: "https://files.test/new" }];
    return Response.json(target);
  } });
  const run = (body, headers = { Authorization: "Bearer verified" }) => handler(new Request("https://function.test", { method: "POST", headers, body: JSON.stringify({ section: "guide", ...body }) }));
  return { run, calls, storageCalls, rows };
}
test("requires a live admin and session before reading documents or storage", async () => {
  for (const options of [{ expired: true }, { actor: { ...actor, app_metadata: { role: "partner" } } }, { invalidSession: true }]) {
    const fixture = setup(options);
    const response = await fixture.run({ action: "load" });
    assert.ok([401, 403].includes(response.status));
    assert.equal(fixture.calls.length, 0); assert.equal(fixture.storageCalls.length, 0);
  }
  const fixture = setup(); assert.equal((await fixture.run({ action: "load" }, {})).status, 401);
});
test("lists both sections including hidden/deleted records and returns audit snapshots", async () => {
  const { run, calls, rows } = setup(); rows[0].fields.Deleted = true;
  for (const section of ["brand", "guide"]) {
    const result = await (await run({ action: "load", section })).json();
    assert.equal(result.documents[0].deleted, true);
    assert.equal(result.documents[0].created.userId, "original-creator");
  }
  assert.ok(calls[0].url.endsWith("tblBrand")); assert.ok(calls[1].url.endsWith("tblGuide"));
});
test("replacement stages first and writes singleton File and server audit together", async () => {
  const { run, calls, storageCalls } = setup();
  const response = await run({ action: "replace", id, expected, ...upload, email: "forged@test", "Replaced by user ID": "forged" });
  assert.equal(response.status, 200);
  const patch = JSON.parse(calls.find(call => call.method === "PATCH").body).fields;
  assert.equal(patch.File.length, 1); assert.equal(patch.File[0].filename, "new.pdf");
  assert.equal(patch["Replaced at"], "2026-11-16T15:30:00.000Z");
  assert.equal(patch["Replaced by user ID"], actor.id); assert.equal(patch["Replaced by email"], actor.email);
  assert.equal(patch.Name, undefined); assert.equal(patch["Created by user ID"], undefined); assert.equal(patch["Visible to partner"], undefined);
  assert.equal(storageCalls[0][0], "upload"); assert.equal(storageCalls[1][0], "remove");
});
test("failed upload cannot touch the current attachment", async () => {
  const { run, calls } = setup({ uploadFailure: true });
  assert.equal((await run({ action: "replace", id, expected, ...upload })).status, 502);
  assert.equal(calls.some(call => call.method), false);
});
test("soft delete retains file, visibility, creation and replacement history", async () => {
  const { run, calls } = setup();
  const response = await run({ action: "delete", id, expected, actorId: "forged" });
  assert.equal(response.status, 200);
  const patch = JSON.parse(calls.find(call => call.method === "PATCH").body).fields;
  assert.deepEqual(patch, { Deleted: true, "Deleted at": "2026-11-16T15:30:00.000Z", "Deleted by user ID": actor.id, "Deleted by email": actor.email });
  const { document } = await response.json();
  assert.equal(document.file.id, "attOld"); assert.equal(document.replaced.at, expected.replacedAt);
  assert.equal(document.created.userId, "original-creator"); assert.equal(document.visible, true);
});
test("visibility changes are independent and do not rewrite event audits", async () => {
  const { run, calls } = setup();
  assert.equal((await run({ action: "visibility", id, expected, visible: false })).status, 200);
  assert.deepEqual(JSON.parse(calls.find(call => call.method === "PATCH").body), { fields: { "Visible to partner": false } });
});
test("new records use supplied Name and file but authenticated creator identity", async () => {
  const { run, calls } = setup();
  assert.equal((await run({ action: "create", name: "Guide (PDF)", visible: false, ...upload, "Created by email": "forged" })).status, 200);
  const fields = JSON.parse(calls.find(call => call.method === "POST").body).fields;
  assert.equal(fields.Name, "Guide (PDF)"); assert.equal(fields["Visible to partner"], false); assert.equal(fields.Deleted, false);
  assert.equal(fields["Created by email"], actor.email); assert.equal(fields["Created by user ID"], actor.id);
  assert.equal(fields["Replaced at"], undefined); assert.equal(fields["Deleted at"], undefined);
});
test("rejects stale, deleted, invalid section, and unsupported/mismatched files without writes", async () => {
  for (const body of [
    { action: "replace", id, expected: { ...expected, fileId: "stale" }, ...upload },
    { action: "replace", id, expected, ...upload, file: btoa("not a pdf") },
    { action: "create", name: "Guide", visible: false, filename: "test.html", file: btoa("<html />") },
    { action: "load", section: "foreign-table" },
  ]) {
    const { run, calls } = setup(); assert.ok((await run(body)).status >= 400); assert.equal(calls.some(call => call.method), false);
  }
  const { run, rows, calls } = setup(); rows[0].fields.Deleted = true;
  assert.equal((await run({ action: "replace", id, expected, ...upload })).status, 409);
  assert.equal(calls.some(call => call.method), false);
});
test("uncertain writes never expose tokens or automatically retry", async () => {
  const { run, calls, storageCalls } = setup({ writeFailure: true });
  const response = await run({ action: "replace", id, expected, ...upload });
  assert.equal(response.status, 502); const body = await response.json(); assert.equal(body.uncertain, true);
  assert.equal(JSON.stringify(body).includes(env.AIRTABLE_TOKEN), false);
  assert.equal(calls.filter(call => call.method).length, 1); assert.equal(storageCalls.some(call => call[0] === "remove"), false);
});
test("bounds streamed bodies without trusting Content-Length", async () => {
  await assert.rejects(boundedBody(new Request("https://test", { method: "POST", body: "x".repeat(7100001) })), /Maximum file size/);
});

test("edit renames the document and attachment using its freshly read URL", async () => {
  const { run, calls, storageCalls } = setup();
  const response = await run({ action: "edit", id, expected, name: "New display name", filename: "renamed.pdf", url: "https://untrusted.test/other" });
  assert.equal(response.status, 200);
  const fields = JSON.parse(calls.find(call => call.method === "PATCH").body).fields;
  assert.deepEqual(fields, { Name: "New display name", File: [{ url: file.url, filename: "renamed.pdf" }] });
  const { document } = await response.json();
  assert.equal(document.name, "New display name"); assert.equal(document.file.name, "renamed.pdf");
  assert.equal(document.replaced.at, expected.replacedAt); assert.equal(document.created.userId, "original-creator");
  assert.equal(document.visible, true); assert.equal(storageCalls.length, 0);
});
test("title-only edit keeps the existing attachment and audit intact", async () => {
  const { run, calls } = setup();
  assert.equal((await run({ action: "edit", id, expected, name: "Updated title", filename: "old.pdf" })).status, 200);
  assert.deepEqual(JSON.parse(calls.find(call => call.method === "PATCH").body).fields, { Name: "Updated title" });
});
test("edit rejects filename paths, changed formats, stale names and empty or unchanged values", async () => {
  for (const input of [
    { name: "Title", filename: "renamed.exe" }, { name: "Title", filename: "../renamed.pdf" },
    { name: "", filename: "old.pdf" }, { name: "Title", filename: "" },
    { name: "Original", filename: "old.pdf" },
    { name: "Title", filename: "new.pdf", expected: { ...expected, name: "stale" } },
    { name: "Title", filename: "new.pdf", expected: { ...expected, filename: "stale.pdf" } },
  ]) {
    const { run, calls } = setup();
    assert.ok((await run({ action: "edit", id, expected, ...input })).status >= 400);
    assert.equal(calls.some(call => call.method), false);
  }
});

test("Last updated comes from Airtable without estimating historical dates", () => {
  assert.equal(documentView(original).updatedAt, null);
  const row = structuredClone(original);
  row.fields["Last updated at"] = "2026-11-16T15:30:00.000Z";
  row.fields["Deleted at"] = "2026-11-16T16:00:00.000Z";
  const result = documentView(row);
  assert.equal(result.updatedAt, "2026-11-16T15:30:00.000Z");
  assert.equal(result.deletedAudit.at, "2026-11-16T16:00:00.000Z");
});
test("content mutations leave the automatic Last updated field to Airtable", async () => {
  for (const body of [
    { action: "create", name: "New document", visible: false, ...upload },
    { action: "replace", id, expected, ...upload },
    { action: "edit", id, expected, name: "New title", filename: "old.pdf" },
    { action: "edit", id, expected, name: "Original", filename: "renamed.pdf" },
  ]) {
    const { run, calls } = setup();
    const response = await run({ ...body, "Last updated at": "forged" });
    assert.equal(response.status, 200);
    const fields = JSON.parse(calls.find(call => call.method).body).fields;
    assert.equal("Last updated at" in fields, false);
    assert.ok("Name" in fields || "File" in fields);
  }
});
