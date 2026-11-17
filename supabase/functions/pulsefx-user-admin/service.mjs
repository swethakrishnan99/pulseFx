import { createAccountAudit } from "../_shared/account-audit.mjs";
import { adminSessionValid } from "../_shared/admin-session.mjs";
import { administratorAccount, manageAdministrator } from "./actions.mjs";
import { createAdministrator } from "./invite.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
class Failure extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
function json(body, status = 200) {
  return Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
function check(result, message) { if (result.error) throw new Failure(message); return result.data; }
export function createStore(admin) {
  return {
    async verifyAdminSession(userId, bearer) { return adminSessionValid(admin, userId, bearer); },
    async listAdmins() { return check(await admin.rpc("list_portal_administrators"), "Unable to load PulseFX administrators."); },
    // Read-only conflict check: internal accounts never get partner records.
    async partnerEmailExists(email) {
      const rows = check(await admin.from("partner_registrations").select("id").eq("email", email).is("deleted_at", null).limit(1), "Unable to check the registered email.");
      return rows.length > 0;
    },
    async claimAdminAction(actor, token) {
      return check(await admin.rpc("claim_admin_account_action", { p_actor: actor, p_token: token }), "Unable to prepare administrator action.");
    },
    async releaseAdminAction(token) { check(await admin.rpc("release_admin_account_action", { p_token: token }), "Unable to release administrator action."); },
    async invalidateAdminCredentials(id, token) {
      check(await admin.rpc("invalidate_admin_credentials", { p_id: id, p_token: token }), "Unable to revoke administrator sessions. Refresh and retry.");
    },
  };
}
export function createPulsefxUserAdminHandler({ env, admin, auth = admin?.auth, store = admin ? createStore(admin) : null, audit = admin ? createAccountAudit(admin) : null }) {
  return async (request) => {
    if (request.method === "OPTIONS") return json(null);
    if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
    try {
      const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
      if (!bearer) throw new Failure("Please sign in to administer PulseFX users.", 401);
      if (!auth || !store) throw new Failure("PulseFX user administration is not configured.", 503);
      const verification = await auth.getUser(bearer);
      if (verification.error || !verification.data?.user) throw new Failure("Please sign in again.", 401);
      const actor = verification.data.user;
      if (actor.app_metadata?.role !== "partner_admin") throw new Failure("Administrator access is required.", 403);
      if (!await store.verifyAdminSession(actor.id, bearer)) throw new Failure("Please sign in again.", 401);
      if (request.method === "GET") {
        const admins = (await store.listAdmins()).map(administratorAccount);
        return json({ admins: audit ? await audit.enrich("admin", admins) : admins, currentUserId: actor.id });
      }
      const raw = await request.text();
      if (raw.length > 5000) throw new Failure("User details are too long.", 413);
      let body;
      try { body = JSON.parse(raw); } catch { throw new Failure("Invalid request.", 400); }
      if (!body || !["create", "edit", "invite", "recovery", "enable", "disable", "delete"].includes(body.action)) throw new Failure("Invalid PulseFX user action.", 400);
      const args = { body, actor, auth, store, env, Failure, check, audit };
      const result = body.action === "create" ? await createAdministrator(args) : await manageAdministrator(args);
      if (audit && result.administrator) result.administrator = (await audit.enrich("admin", [result.administrator]))[0];
      return json(result);
    } catch (error) {
      return json({ error: error instanceof Failure ? error.message : "Unable to complete this request. Refresh the user list before trying again." }, error instanceof Failure ? error.status : 502);
    }
  };
}
