import test from "node:test";
import assert from "node:assert/strict";
import { createPulsefxUserAdminHandler } from "./service.mjs";

const actor = { id: "admin-actor", app_metadata: { role: "partner_admin" } };
const details = { action: "create", name: "New Admin", email: "new@example.test", confirmAdmin: true };
const ok = (data) => ({ data, error: null });
function setup(options = {}) {
  let users = options.users || [];
  const events = [];
  let linksFailed = options.linkFailures || 0;
  const auth = {
    getUser: async () => options.expired ? { error: {} } : ok({ user: options.actor || actor }),
    admin: {
      async listUsers({ page, perPage }) { events.push("list"); return ok({ users: users.slice((page - 1) * perPage, page * perPage) }); },
      async createUser(input) {
        events.push("create");
        assert.deepEqual(input, { email: details.email, user_metadata: { full_name: details.name }, app_metadata: { role: "partner_admin", admin_invited_by: actor.id } });
        const user = { id: "new-admin", ...input };
        users.push(user);
        return options.creationTimedOut ? { error: { message: "private-provider-error" } } : ok({ user });
      },
      async generateLink(input) {
        events.push("link");
        assert.equal(input.email, details.email);
        assert.equal(input.options.redirectTo, "https://portal.example/");
        if (linksFailed-- > 0) return { error: { message: "private-provider-error" } };
        return ok({ user: options.generatedUser || users.find((user) => user.email === input.email),
          properties: options.missingToken ? {} : { hashed_token: "private-link-token" } });
      },
    },
  };
  const handler = createPulsefxUserAdminHandler({ auth,
    env: { PORTAL_URL: "https://portal.example/?old=query#hash", ...options.env },
    store: { verifyAdminSession: async () => true, partnerEmailExists: async (email) => (options.partners || []).some((row) => row.email === email) },
    fetchImpl: () => { throw new Error("Administrator creation must never access Airtable"); },
  });
  const request = (body = details, token = "session") => handler(new Request("https://api.example/pulsefx-user-admin", {
    method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  }));
  return { request, events, users: () => users };
}

test("only verified admins can create an admin, regardless of user metadata", async () => {
  for (const options of [{ expired: true }, { actor: { user_metadata: { role: "partner_admin" } } }, { actor: { app_metadata: { role: "partner" } } }]) {
    const fixture = setup(options);
    assert.ok([401, 403].includes((await fixture.request()).status));
    assert.deepEqual(fixture.events, []);
  }
  assert.equal((await setup().request(details, "")).status, 401);
});

test("admin creation validates explicit confirmation and input before touching Auth", async () => {
  for (const patch of [{ confirmAdmin: false }, { confirmAdmin: "true" }, { name: " " }, { name: "x".repeat(121) }, { email: "invalid" }]) {
    const fixture = setup();
    assert.equal((await fixture.request({ ...details, ...patch })).status, 400);
    assert.deepEqual(fixture.events, []);
  }
});

test("admin creation sets the trusted role atomically without partner or Airtable provisioning", async () => {
  const fixture = setup();
  const response = await fixture.request({ ...details, email: " New@Example.Test ", role: "other" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.administrator, { id: "new-admin", name: details.name, email: details.email, role: "partner_admin" });
  assert.equal(body.link, "https://portal.example/?token_hash=private-link-token&type=invite");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.administrator.admin_invited_by, undefined);
  assert.deepEqual(fixture.events, ["list", "create", "link"]);
});

test("existing partners and unrelated Auth accounts cannot be promoted", async () => {
  const partner = setup({ partners: [{ email: details.email }] });
  assert.equal((await partner.request()).status, 409);
  assert.deepEqual(partner.events, []);
  for (const user of [
    { id: "partner", email: details.email, app_metadata: {} },
    { id: "existing-admin", email: details.email, app_metadata: { role: "partner_admin" } },
    { id: "other-inviter", email: details.email, app_metadata: { role: "partner_admin", admin_invited_by: "other-admin" } },
    { id: actor.id, email: details.email, app_metadata: { role: "partner_admin", admin_invited_by: actor.id } },
    { id: "partner-admin", email: details.email, app_metadata: { role: "partner_admin", admin_invited_by: actor.id, partner_registration_id: "partner" } },
  ]) {
    const fixture = setup({ users: [user] });
    assert.equal((await fixture.request()).status, 409);
    assert.deepEqual(fixture.events, ["list"]);
  }
});

test("failed invitation links can be retried without another Auth user or exposing raw errors", async () => {
  const fixture = setup({ linkFailures: 1 });
  const response = await fixture.request();
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private-provider-error/);
  assert.equal((await fixture.request()).status, 200);
  assert.equal(fixture.users().length, 1);
  assert.equal(fixture.events.filter((event) => event === "create").length, 1);
});

test("a timed-out successful creation is reconciled safely", async () => {
  const fixture = setup({ creationTimedOut: true });
  assert.equal((await fixture.request()).status, 200);
  assert.equal(fixture.users().length, 1);
});

test("retrying an opened invitation uses recovery and never reactivates a banned admin", async () => {
  const user = { id: "new-admin", email: details.email, email_confirmed_at: new Date().toISOString(),
    app_metadata: { role: "partner_admin", admin_invited_by: actor.id } };
  const fixture = setup({ users: [user] });
  const response = await fixture.request();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.kind, "recovery");
  assert.ok(body.link.endsWith("type=recovery"));
  const banned = setup({ users: [{ ...user, banned_until: "2099-01-01T00:00:00Z" }] });
  assert.equal((await banned.request()).status, 409);
  assert.deepEqual(banned.events, ["list"]);
});

test("pagination finds existing accounts beyond the first page", async () => {
  const users = Array.from({ length: 100 }, (_, i) => ({ id: `user-${i}`, email: `${i}@example.test` }));
  users.push({ id: "existing", email: details.email });
  const fixture = setup({ users });
  assert.equal((await fixture.request()).status, 409);
  assert.deepEqual(fixture.events, ["list", "list"]);
});

test("bad configuration and mismatched generated links do not return credentials", async () => {
  for (const env of [{ PORTAL_URL: "" }, { PORTAL_URL: "http://portal.example/" }]) {
    const fixture = setup({ env });
    assert.equal((await fixture.request()).status, 503);
    assert.deepEqual(fixture.events, []);
  }
  for (const options of [{ missingToken: true }, { generatedUser: { id: "wrong", app_metadata: { role: "partner_admin" } } }, { generatedUser: { id: "new-admin", app_metadata: {} } }]) {
    const response = await setup(options).request();
    assert.equal(response.status, 502);
    assert.equal((await response.json()).link, undefined);
  }
});
