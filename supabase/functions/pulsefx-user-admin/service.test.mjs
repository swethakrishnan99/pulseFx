import test from "node:test";
import assert from "node:assert/strict";
import { createPulsefxUserAdminHandler } from "./service.mjs";

const actor = { id: "10000000-0000-4000-8000-000000000001", app_metadata: { role: "partner_admin" } };
function setup(options = {}) {
  const events = [];
  const handler = createPulsefxUserAdminHandler({ env: {}, auth: {
    getUser: async () => { events.push("verify"); return options.expired ? { error: {} } : { data: { user: options.user || actor } }; },
  }, store: {
    verifyAdminSession: async () => { events.push("session"); return !options.revoked; },
    listAdmins: async () => { events.push("admins"); return options.rows || []; },
    partnerEmailExists: async () => { throw Error("GET must not query partner data"); },
  } });
  const request = (method = "GET", body, token = "session") => handler(new Request("https://project.example/functions/v1/pulsefx-user-admin", {
    method, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  }));
  return { request, events };
}
test("internal PulseFX users are listed independently with safe Auth summaries", async () => {
  const createdAt = "2026-11-14T15:23:00Z";
  const f = setup({ rows: [
    { id: actor.id, name: "Manual Admin", email: "admin@example.test", created_at: createdAt, activated: true, lock_token: "secret", raw_app_meta_data: { role: "partner_admin" } },
    { id: "pending-admin", name: "Pending Admin", email: "pending@example.test", activated: false },
    { id: "banned-admin", name: "Banned Admin", email: "banned@example.test", activated: true, disabled: true },
  ] });
  const response = await f.request(); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.deepEqual(body.admins[0], { id: actor.id, name: "Manual Admin", email: "admin@example.test", role: "partner_admin", supabaseId: actor.id, createdAt, status: "Active" });
  assert.equal(body.admins[1].status, "Awaiting activation"); assert.equal(body.admins[2].status, "Deactivated");
  assert.equal(body.currentUserId, actor.id); assert.equal(body.partners, undefined);
  assert.deepEqual(f.events, ["verify", "session", "admins"]);
});
test("anonymous, expired, ordinary and revoked users cannot list internal accounts", async () => {
  assert.equal((await setup().request("GET", undefined, "")).status, 401);
  for (const options of [{ expired: true }, { revoked: true }, { user: { id: actor.id, user_metadata: { role: "partner_admin" } } }]) {
    const f = setup(options); assert.ok([401,403].includes((await f.request()).status)); assert.equal(f.events.includes("admins"), false);
  }
});
test("preflight and unsupported methods never verify Auth or query users", async () => {
  const f = setup(); assert.equal((await f.request("OPTIONS")).status, 200); assert.equal((await f.request("DELETE")).status, 405); assert.deepEqual(f.events, []);
});
test("malformed, oversized and legacy partner actions cannot mutate internal accounts", async () => {
  for (const body of ["{", null, { action: "create-admin" }, { action: "admin-edit" }, { action: "membership" }]) {
    const f = setup(); assert.equal((await f.request("POST", body)).status, 400); assert.deepEqual(f.events, ["verify", "session"]);
  }
  assert.equal((await setup().request("POST", "x".repeat(5001))).status, 413);
});
