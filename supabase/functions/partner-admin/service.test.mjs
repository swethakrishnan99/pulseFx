import test from "node:test";
import assert from "node:assert/strict";
import { createPartnerAdminHandler } from "./service.mjs";

const id = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";
const partnerId = "rec12345678901234";
const env = { PORTAL_URL: "https://partners.example/portal/", AIRTABLE_TOKEN: "airtable-secret", AIRTABLE_BASE_ID: "app-test" };
const values = { company: "New Partner", name: "Alex Morgan", email: "alex@example.com" };
const success = (data) => ({ data, error: null });

function setup(options = {}) {
  const events = [];
  let rows = options.row ? [{ ...options.row }] : [];
  let user = options.user;
  let airtableFailures = options.airtableFailures || 0;
  let linkFailures = options.linkFailures || 0;
  let membershipFailures = options.membershipFailures || 0;
  const auth = {
    async getUser(token) {
      events.push("verify");
      assert.equal(token, "session");
      return options.expired ? { error: new Error("expired") } : success({ user: options.caller || { app_metadata: { role: "partner_admin" } } });
    },
    admin: {
      async listUsers() { events.push("list-users"); return success({ users: user ? [user] : [] }); },
      async createUser(input) {
        events.push("create-user");
        assert.equal(input.email, values.email);
        assert.equal(input.password, undefined);
        user = { id: userId, email: input.email, app_metadata: input.app_metadata };
        return success({ user });
      },
      async getUserById(value) { events.push("get-user"); assert.equal(value, userId); return success({ user }); },
      async updateUserById(value, input) {
        assert.equal(value, userId);
        assert.ok(["none", "876000h"].includes(input.ban_duration));
        events.push(input.ban_duration === "none" ? "auth-enable" : "auth-disable");
        if (options.authChangeFailure) return { error: new Error("provider secret") };
        return success({ user });
      },
      async deleteUser(value) {
        assert.equal(value, userId);
        events.push("auth-delete");
        if (options.deleteFailure) return { error: new Error("provider secret") };
        user = undefined;
        rows[0].user_id = null;
        return success({ user: null });
      },
      async generateLink(input) {
        events.push("generate-link");
        assert.ok(rows[0].ready, "must link the account before returning a credential");
        assert.equal(input.email, values.email);
        assert.equal(input.type, (options.confirmed || options.recovering) ? "recovery" : "invite");
        if (linkFailures-- > 0) return { error: new Error("secret raw provider error") };
        return success({ user: options.generatedUser || user, properties: options.missingToken ? {} : { hashed_token: "private-token" } });
      },
    },
  };
  const store = {
    async list() { events.push("list"); return rows.filter((row) => !row.deleted_at).map((row) => ({ ...row })); },
    async reserve(input) {
      events.push("reserve");
      if (!rows.length) rows.push({ ...input, id, ready: false, activated: false });
      return { ...rows[0] };
    },
    async claim(value, token) {
      events.push("claim");
      assert.equal(value, id);
      if (options.locked) return null;
      rows[0].lock_token = token;
      if (options.activateAfterClaim) rows[0].activated = true;
      if (options.disableAfterClaim) rows[0].disabled = true;
      return { ...rows[0] };
    },
    async save(value, token, patch) {
      events.push("save");
      assert.equal(value, id);
      assert.equal(token, rows[0].lock_token);
      Object.assign(rows[0], patch);
      return { ...rows[0] };
    },
    async membership(value, partner) {
      events.push("membership");
      assert.equal(value, userId);
      assert.equal(partner, partnerId);
      if (membershipFailures-- > 0) throw new Error("membership error with secret");
    },
    async setAccess(value, token, enabled) {
      assert.equal(value, id);
      assert.equal(token, rows[0].lock_token);
      events.push(enabled ? "access-enable" : "access-disable");
      if (options.accessChangeFailure) throw new Error("rpc secret");
      rows[0].disabled = !enabled;
      rows[0].membershipEnabled = enabled;
    },
    async release(value, token) { events.push("release"); assert.equal(value, id); assert.equal(token, rows[0].lock_token); delete rows[0].lock_token; },
  };
  const handler = createPartnerAdminHandler({ env: { ...env, ...options.env }, auth, store,
    fetchImpl: async (url, input) => {
      events.push("airtable");
      assert.equal(url, "https://api.airtable.com/v0/app-test/Partners");
      assert.equal(input.method, "PATCH");
      const body = JSON.parse(input.body);
      assert.deepEqual(body.performUpsert.fieldsToMergeOn, ["Portal ID"]);
      assert.deepEqual(body.records[0].fields, { Name: values.company, "Portal ID": id });
      if (airtableFailures-- > 0) return Response.json({ error: env.AIRTABLE_TOKEN }, { status: 429 });
      return Response.json({ records: [{ id: partnerId }] });
    },
  });
  const request = (body, method = "POST", token = "session") => handler(new Request("https://project.example/functions/v1/partner-admin", {
    method, headers: token ? { authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {},
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  }));
  return { request, events, rows: () => rows };
}

test("missing or expired credentials cannot query or mutate partner records", async () => {
  const missing = setup();
  assert.equal((await missing.request({}, "POST", null)).status, 401);
  assert.deepEqual(missing.events, []);
  const expired = setup({ expired: true });
  assert.equal((await expired.request({})).status, 401);
  assert.deepEqual(expired.events, ["verify"]);
});

test("email matches and user-editable metadata cannot grant admin access", async () => {
  const fixture = setup({ caller: { email: "partnerships@pulsefx.com", user_metadata: { role: "partner_admin" } } });
  assert.equal((await fixture.request({ action: "create", ...values })).status, 403);
  assert.deepEqual(fixture.events, ["verify"]);
});

test("preflight and unsupported methods never access upstream services", async () => {
  const fixture = setup();
  assert.equal((await fixture.request(undefined, "OPTIONS", null)).status, 200);
  assert.equal((await fixture.request(undefined, "DELETE", null)).status, 405);
  assert.deepEqual(fixture.events, []);
});

test("missing invitation configuration, invalid input and malformed JSON fail before mutation", async () => {
  const unconfigured = setup({ env: { PORTAL_URL: "" } });
  assert.equal((await unconfigured.request({ action: "create", ...values })).status, 503);
  assert.deepEqual(unconfigured.events, ["verify"]);
  for (const body of ["{", { action: "create", ...values, email: "bad" }, { action: "create", ...values, company: " " }, { action: "invite", id: "bad" }, { action: "delete" }]) {
    const fixture = setup();
    assert.equal((await fixture.request(body)).status, 400);
    assert.deepEqual(fixture.events, ["verify"]);
  }
});

test("creation returns a private activation link only after Auth, Airtable and membership are ready", async () => {
  const fixture = setup();
  const response = await fixture.request({ action: "create", ...values, email: " Alex@Example.com " });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.link, "https://partners.example/portal/?token_hash=private-token&type=invite");
  assert.equal(body.partner.status, "Awaiting activation");
  assert.equal(body.partner.email, values.email);
  assert.equal(body.partner.lock_token, undefined);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(fixture.events.indexOf("airtable") < fixture.events.indexOf("membership"));
  assert.ok(fixture.events.indexOf("membership") < fixture.events.indexOf("generate-link"));
  assert.equal(fixture.events.at(-1), "release");
});

test("list derives safe account summaries and never returns invitation credentials or internal fields", async () => {
  const fixture = setup({ row: { id, ...values, activated: true, ready: true, lock_token: "private-lock", user_id: userId } });
  const body = await (await fixture.request(undefined, "GET")).json();
  assert.deepEqual(body.partners, [{ id, ...values, status: "Active", profileEditPending: false, previousEmail: null }]);
});

test("pending Airtable updates are visible without exposing internal error details", async () => {
  const fixture = setup({ row: { id, ...values, ready: true, sync_pending: true, sync_error: true, last_error: "internal-details" } });
  const body = await (await fixture.request(undefined, "GET")).json();
  assert.equal(body.partners[0].airtableSyncPending, true);
  assert.equal(body.partners[0].airtableSyncError, true);
  assert.equal(body.partners[0].last_error, undefined);
});

test("activated accounts cannot receive another invitation", async () => {
  const fixture = setup({ row: { id, ...values, activated: true, ready: true, user_id: userId } });
  assert.equal((await fixture.request({ action: "invite", id })).status, 409);
  assert.ok(!fixture.events.includes("generate-link"));
  const race = setup({ row: { id, ...values }, activateAfterClaim: true });
  assert.equal((await race.request({ action: "invite", id })).status, 409);
  assert.ok(!race.events.includes("generate-link"));
  assert.equal(race.events.at(-1), "release");
});

test("missing records and concurrent provisioning cannot generate credentials", async () => {
  const missing = setup();
  assert.equal((await missing.request({ action: "invite", id })).status, 404);
  const locked = setup({ locked: true });
  assert.equal((await locked.request({ action: "create", ...values })).status, 409);
  assert.ok(!locked.events.includes("create-user"));
});

test("Airtable failures preserve resumable progress and never expose tokens or raw errors", async () => {
  const fixture = setup({ airtableFailures: 1 });
  const first = await fixture.request({ action: "create", ...values });
  assert.equal(first.status, 502);
  assert.ok(!(await first.text()).includes(env.AIRTABLE_TOKEN));
  assert.ok(!fixture.events.includes("generate-link"));
  assert.equal((await fixture.request({ action: "invite", id })).status, 200);
  assert.equal(fixture.events.filter((event) => event === "create-user").length, 1);
});

test("membership and link failures can be retried without recreating Auth or Airtable records", async () => {
  for (const option of [{ membershipFailures: 1 }, { linkFailures: 1 }]) {
    const fixture = setup(option);
    const first = await fixture.request({ action: "create", ...values });
    assert.equal(first.status, 502);
    assert.ok(!(await first.text()).includes("secret"));
    assert.equal((await fixture.request({ action: "invite", id })).status, 200);
    assert.equal(fixture.events.filter((event) => event === "create-user").length, 1);
    assert.equal(fixture.events.filter((event) => event === "airtable").length, 1);
  }
});

test("unrelated Auth accounts cannot be silently attached by email", async () => {
  const fixture = setup({ user: { id: userId, email: values.email, app_metadata: {} } });
  assert.equal((await fixture.request({ action: "create", ...values })).status, 409);
  assert.ok(!fixture.events.includes("airtable"));
  assert.ok(!fixture.events.includes("generate-link"));
});

test("confirmed email without a password can resume activation through a recovery link", async () => {
  const fixture = setup({ row: { id, ...values, ready: true, partner_id: partnerId, user_id: userId }, confirmed: true,
    user: { id: userId, email: values.email, email_confirmed_at: "2026-11-13", app_metadata: { partner_registration_id: id } } });
  const response = await fixture.request({ action: "invite", id });
  assert.equal(response.status, 200);
  assert.equal(new URL((await response.json()).link).searchParams.get("type"), "recovery");
});


const registered = { id, ...values, ready: true, user_id: userId, partner_id: partnerId, activated: true };
const registeredUser = { id: userId, email: values.email, app_metadata: { partner_registration_id: id } };

test("deactivation revokes data access before banning and preserves the partner record", async () => {
  const fixture = setup({ row: registered, user: registeredUser });
  const response = await fixture.request({ action: "disable", id });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).partner.status, "Deactivated");
  assert.equal(fixture.rows()[0].membershipEnabled, false);
  assert.equal(fixture.rows()[0].partner_id, partnerId);
  assert.ok(fixture.events.indexOf("access-disable") < fixture.events.indexOf("auth-disable"));
  assert.ok(!fixture.events.includes("auth-delete"));
});

test("reactivation unbans first and only then restores data access", async () => {
  const fixture = setup({ row: { ...registered, disabled: true }, user: registeredUser });
  const response = await fixture.request({ action: "enable", id });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).partner.status, "Active");
  assert.equal(fixture.rows()[0].membershipEnabled, true);
  assert.ok(fixture.events.indexOf("auth-enable") < fixture.events.indexOf("access-enable"));
});

test("delete removes only the login and retains a hidden registration for Airtable history", async () => {
  const fixture = setup({ row: registered, user: registeredUser });
  const response = await fixture.request({ action: "delete", id });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, id });
  assert.equal(fixture.rows()[0].user_id, null);
  assert.ok(fixture.rows()[0].deleted_at);
  assert.equal(fixture.rows()[0].partner_id, partnerId);
  assert.equal(fixture.rows()[0].membershipEnabled, false);
  assert.ok(fixture.events.indexOf("access-disable") < fixture.events.indexOf("auth-delete"));
  assert.ok(!fixture.events.includes("airtable"));
  assert.deepEqual((await (await fixture.request(undefined, "GET")).json()).partners, []);
});

test("failed deletion remains blocked and visible for retry without exposing provider errors", async () => {
  const fixture = setup({ row: registered, user: registeredUser, deleteFailure: true });
  const response = await fixture.request({ action: "delete", id });
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes("secret"));
  assert.equal(fixture.rows()[0].membershipEnabled, false);
  assert.equal(fixture.rows()[0].deleted_at, undefined);
  assert.equal(fixture.events.at(-1), "release");
});

test("failed bans keep data access revoked and failed unbans never restore access", async () => {
  const disable = setup({ row: registered, user: registeredUser, authChangeFailure: true });
  assert.equal((await disable.request({ action: "disable", id })).status, 502);
  assert.equal(disable.rows()[0].membershipEnabled, false);
  const enable = setup({ row: { ...registered, disabled: true, membershipEnabled: false }, user: registeredUser, authChangeFailure: true });
  assert.equal((await enable.request({ action: "enable", id })).status, 502);
  assert.equal(enable.rows()[0].membershipEnabled, false);
  assert.ok(!enable.events.includes("access-enable"));
});

test("lifecycle actions do not require Airtable or invitation configuration", async () => {
  const fixture = setup({ row: registered, user: registeredUser, env: { PORTAL_URL: "", AIRTABLE_TOKEN: "", AIRTABLE_BASE_ID: "" } });
  assert.equal((await fixture.request({ action: "disable", id })).status, 200);
});

test("administrator, own, mismatched and missing accounts cannot be reactivated or deleted incorrectly", async () => {
  for (const action of ["disable", "enable", "delete"]) {
    const adminTarget = setup({ row: registered, user: { ...registeredUser, app_metadata: { ...registeredUser.app_metadata, role: "partner_admin" } } });
    assert.equal((await adminTarget.request({ action, id })).status, 403);
    assert.ok(!adminTarget.events.includes("access-disable"));
    const self = setup({ row: registered, user: registeredUser, caller: { id: userId, app_metadata: { role: "partner_admin" } } });
    assert.equal((await self.request({ action, id })).status, 403);
    const mismatch = setup({ row: registered, user: { ...registeredUser, email: "another@example.com" } });
    assert.equal((await mismatch.request({ action, id })).status, 409);
  }
  const missing = setup({ row: registered });
  assert.equal((await missing.request({ action: "enable", id })).status, 409);
});

test("incomplete deactivated accounts can resume setup without prematurely restoring data access", async () => {
  const fixture = setup({ row: { ...registered, ready: false, disabled: true, activated: false, membershipEnabled: false }, user: registeredUser });
  const response = await fixture.request({ action: "enable", id });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).partner.status, "Setup incomplete");
  assert.equal(fixture.rows()[0].membershipEnabled, false);
});

test("normal partners cannot call any lifecycle action", async () => {
  for (const action of ["disable", "enable", "delete"]) {
    const fixture = setup({ row: registered, user: registeredUser, caller: { id: "partner", app_metadata: {} } });
    assert.equal((await fixture.request({ action, id })).status, 403);
    assert.deepEqual(fixture.events, ["verify"]);
  }
});

test("deactivated accounts cannot receive invitation links even without a password", async () => {
  const fixture = setup({ row: { ...registered, activated: false, disabled: true }, user: registeredUser });
  assert.equal((await fixture.request({ action: "invite", id })).status, 409);
  assert.ok(!fixture.events.includes("generate-link"));
});

test("a deleted login can be registered again using the same Airtable partner record", async () => {
  const fixture = setup({ row: { ...registered, user_id: null, activated: false, ready: false, disabled: true, deleted_at: "2026-11-13" } });
  const response = await fixture.request({ action: "create", ...values });
  assert.equal(response.status, 200);
  assert.equal(fixture.rows()[0].deleted_at, null);
  assert.equal(fixture.rows()[0].partner_id, partnerId);
  assert.ok(!fixture.events.includes("airtable"));
});


const activatedUser = { ...registeredUser, email_confirmed_at: "2026-11-13T12:00:00Z" };

test("password recovery returns a private link for an active owned account without provisioning or changing access", async () => {
  const fixture = setup({ row: registered, user: activatedUser, recovering: true });
  const response = await fixture.request({ action: "recovery", id });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.kind, "recovery");
  assert.equal(body.partner.status, "Active");
  assert.equal(body.link, "https://partners.example/portal/?token_hash=private-token&type=recovery");
  for (const event of ["create-user", "airtable", "membership", "save", "access-enable", "access-disable", "auth-enable", "auth-disable", "auth-delete"]) assert.ok(!fixture.events.includes(event), event);
  assert.equal(fixture.events.at(-1), "release");
});

test("password recovery is independent of Airtable configuration", async () => {
  const fixture = setup({ row: registered, user: activatedUser, recovering: true, env: { AIRTABLE_TOKEN: "", AIRTABLE_BASE_ID: "" } });
  assert.equal((await fixture.request({ action: "recovery", id })).status, 200);
});

test("anonymous users and ordinary partners cannot generate recovery links", async () => {
  const anonymous = setup({ row: registered, user: activatedUser, recovering: true });
  assert.equal((await anonymous.request({ action: "recovery", id }, "POST", null)).status, 401);
  assert.deepEqual(anonymous.events, []);
  const partner = setup({ row: registered, user: activatedUser, caller: { id: userId, app_metadata: {} } });
  assert.equal((await partner.request({ action: "recovery", id })).status, 403);
  assert.deepEqual(partner.events, ["verify"]);
});

test("unactivated, incomplete, deactivated and deleted accounts cannot receive recovery links", async () => {
  for (const patch of [{ activated: false }, { ready: false }, { disabled: true }]) {
    const fixture = setup({ row: { ...registered, ...patch }, user: activatedUser });
    assert.equal((await fixture.request({ action: "recovery", id })).status, 409);
    assert.ok(!fixture.events.includes("generate-link"));
  }
  const deleted = setup({ row: { ...registered, deleted_at: "2026-11-13" }, user: activatedUser });
  assert.equal((await deleted.request({ action: "recovery", id })).status, 404);
  const race = setup({ row: registered, user: activatedUser, disableAfterClaim: true });
  assert.equal((await race.request({ action: "recovery", id })).status, 409);
  assert.ok(!race.events.includes("generate-link"));
});

test("recovery rechecks Auth identity and cannot expose links for administrators or mismatched users", async () => {
  for (const patch of [{ email: "other@example.com" }, { app_metadata: {} }, { email_confirmed_at: null }, { banned_until: "2099-01-01T00:00:00Z" }]) {
    const fixture = setup({ row: registered, user: { ...activatedUser, ...patch } });
    assert.equal((await fixture.request({ action: "recovery", id })).status, 409);
    assert.ok(!fixture.events.includes("generate-link"));
  }
  const admin = setup({ row: registered, user: { ...activatedUser, app_metadata: { ...activatedUser.app_metadata, role: "partner_admin" } } });
  assert.equal((await admin.request({ action: "recovery", id })).status, 403);
  const self = setup({ row: registered, user: activatedUser, caller: { id: userId, app_metadata: { role: "partner_admin" } } });
  assert.equal((await self.request({ action: "recovery", id })).status, 403);
});

test("failed or mismatched recovery generation cannot return a credential or alter account state", async () => {
  for (const option of [{ linkFailures: 1 }, { missingToken: true }, { generatedUser: { id: "unrelated-user" } }]) {
    const fixture = setup({ row: registered, user: activatedUser, recovering: true, ...option });
    const response = await fixture.request({ action: "recovery", id });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.link, undefined);
    assert.ok(!JSON.stringify(body).includes("secret"));
    assert.equal(fixture.rows()[0].activated, true);
    assert.equal(fixture.events.at(-1), "release");
  }
});

test("unfinished profile edits block invitations, recovery and lifecycle actions until resumed", async () => {
  for (const action of ["invite", "recovery", "disable", "enable", "delete"]) {
    const fixture = setup({ row: { ...registered, profile_edit_pending: true }, user: activatedUser });
    assert.equal((await fixture.request({ action, id })).status, 409);
    assert.equal(fixture.events.some((event) => ["generate-link", "auth-enable", "auth-disable", "auth-delete"].includes(event)), false);
  }
});
