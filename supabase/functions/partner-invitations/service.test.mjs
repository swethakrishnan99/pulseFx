import test from "node:test";
import assert from "node:assert/strict";
import { createPartnerInvitationsHandler } from "./service.mjs";
import { createPartnerAdminHandler } from "../partner-admin/service.mjs";
const dependencies = {
  env: {}, auth: { getUser: async () => ({ data: { user: { id: "admin", app_metadata: { role: "partner_admin" } } } }) },
  store: { verifyAdminSession: async () => true },
};
const request = body => new Request("https://edge.test", { method: "POST", headers: { authorization: "Bearer session" }, body: JSON.stringify(body) });
test("invitation endpoint rejects administrative account actions", async () => {
  const handler = createPartnerInvitationsHandler(dependencies);
  for (const action of ["disable", "enable", "delete", "edit", "recovery", "invite"]) assert.equal((await handler(request({ action }))).status, 400);
  assert.equal((await handler(new Request("https://edge.test", { headers: { authorization: "Bearer session" } }))).status, 405);
});
test("administration endpoint no longer creates partners or queues invitation emails", async () => {
  const handler = createPartnerAdminHandler(dependencies);
  assert.equal((await handler(request({ action: "create" }))).status, 400);
});
test("invitation endpoint requires verified administrator access", async () => {
  const handler = createPartnerInvitationsHandler({ ...dependencies, auth: { getUser: async () => ({ data: { user: { app_metadata: {} } } }) } });
  assert.equal((await handler(new Request("https://edge.test", { method: "POST" }))).status, 401);
  assert.equal((await handler(request({ action: "create" }))).status, 403);
});
