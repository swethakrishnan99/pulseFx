import test from "node:test";
import assert from "node:assert/strict";
import { createPartnerAccessFlow } from "./partnerAccess.mjs";

function setup(options = {}) {
  const calls = [];
  let checks = 0, saves = 0;
  const client = { async rpc(name) { assert.equal(name, "partner_portal_session_valid"); return { data: !options.revokedSession, error: options.sessionCheckOffline ? new Error("offline") : null }; }, auth: {
    async verifyOtp(input) {
      calls.push(["verify", input.type]);
      checks++;
      if (options.networkFirst && checks === 1) throw new Error("offline");
      if (options.used) return { error: { code: "otp_expired", status: 403 } };
      return { data: { session: { access_token: "test-session" } } };
    },
    async updateUser() {
      calls.push(["save"]);
      saves++;
      if (options.expiredSession) return { error: { code: "session_not_found", status: 401 } };
      if (options.weakFirst && saves === 1) return { error: { code: "weak_password", status: 422 } };
      if (options.samePassword) return { error: { code: "same_password", status: 422 } };
      return { data: { user: {} } };
    },
    async signOut(input) { calls.push(["logout", input.scope]); if (options.logoutOffline) throw new Error("offline"); },
  } };
  return { flow: createPartnerAccessFlow(client, { token_hash: "test-token", type: options.type || "recovery" }), calls };
}
test("a used link is rejected before any password operation", async () => {
  const { flow, calls } = setup({ used: true });
  assert.deepEqual(await flow.verify(), { valid: false, reason: "invalid" });
  await assert.rejects(flow.savePassword("test-password"), { code: "invalid_link" });
  assert.deepEqual(calls, [["verify", "recovery"]]);
});
test("mount replay, repeated checks and save reuse one verification request", async () => {
  const { flow, calls } = setup();
  const first = flow.verify(), replay = flow.verify();
  assert.equal(first, replay);
  assert.deepEqual(await first, { valid: true });
  await flow.savePassword("test-password");
  assert.deepEqual(calls, [["verify", "recovery"], ["save"], ["logout", "global"]]);
});
test("a page flow cannot update a password twice after success", async () => {
  const { flow, calls } = setup();
  await flow.savePassword("test-password");
  await assert.rejects(flow.savePassword("another-password"), { code: "already_completed" });
  assert.equal(calls.filter(([event]) => event === "save").length, 1);
});
test("concurrent submits cannot make two password updates", async () => {
  const { flow, calls } = setup();
  const first = flow.savePassword("test-password");
  await assert.rejects(flow.savePassword("another-password"), { code: "in_progress" });
  await first;
  assert.equal(calls.filter(([event]) => event === "save").length, 1);
});
test("network errors are distinguished from expired links and can be retried", async () => {
  const { flow, calls } = setup({ networkFirst: true });
  assert.deepEqual(await flow.verify(), { valid: false, reason: "unavailable" });
  assert.deepEqual(await flow.verify({ retry: true }), { valid: true });
  await flow.savePassword("test-password");
  assert.equal(calls.filter(([event]) => event === "verify").length, 2);
});
test("password policy retries use the verified session without replaying the consumed token", async () => {
  const { flow, calls } = setup({ weakFirst: true });
  await assert.rejects(flow.savePassword("weak-password"), { code: "password_rejected" });
  await flow.savePassword("stronger-password");
  assert.equal(calls.filter(([event]) => event === "verify").length, 1);
  assert.equal(calls.filter(([event]) => event === "save").length, 2);
});
test("expired sessions and unchanged passwords report the correct next step", async () => {
  await assert.rejects(setup({ expiredSession: true }).flow.savePassword("test-password"), { code: "session_expired" });
  await assert.rejects(setup({ samePassword: true }).flow.savePassword("test-password"), { code: "same_password" });
});
test("invitation logout stays local and logout outages do not undo a saved password", async () => {
  const { flow, calls } = setup({ type: "invite", logoutOffline: true });
  await flow.savePassword("test-password");
  assert.deepEqual(calls.at(-1), ["logout", "local"]);
  await assert.rejects(flow.savePassword("another-password"), { code: "already_completed" });
});

test("email-change revoked sessions cannot save a password even if their link was previously verified", async () => {
  const { flow, calls } = setup({ revokedSession: true });
  assert.deepEqual(await flow.verify(), { valid: true });
  await assert.rejects(flow.savePassword("test-password"), { code: "session_expired" });
  assert.equal(calls.some(([event]) => event === "save"), false);
});
