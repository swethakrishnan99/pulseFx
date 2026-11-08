import assert from "node:assert/strict";
import test from "node:test";
import { findPartnerMembership } from "./membership.mjs";

const config = {
  projectUrl: "https://example.supabase.co",
  publishableKey: "public-test-key",
  accessToken: "verified-session-token",
  userId: "user-a",
};

test("membership requests use the caller's token and filter by their user ID", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.origin, config.projectUrl);
    assert.equal(url.pathname, "/rest/v1/partner_memberships");
    assert.equal(url.searchParams.get("select"), "partner_id");
    assert.equal(url.searchParams.get("user_id"), "eq.user-a");
    assert.equal(options.headers.apikey, config.publishableKey);
    assert.equal(options.headers.authorization, "Bearer " + config.accessToken);
    return Response.json([{ partner_id: "partner-a" }]);
  });
  assert.equal(await findPartnerMembership(config), "partner-a");
});

test("an authenticated account without a membership receives no partner access", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json([]));
  assert.equal(await findPartnerMembership(config), null);
});

test("a failed membership lookup cannot grant access", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Denied" }, { status: 403 }));
  await assert.rejects(findPartnerMembership(config), /Unable to read partner membership/);
});
