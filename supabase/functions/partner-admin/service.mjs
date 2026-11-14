const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recordId = /^rec[A-Za-z0-9]{14}$/;
class Failure extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
function json(body, status = 200) {
  return Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
function check(result, message) {
  if (result.error) throw new Failure(message);
  return result.data;
}
function account(row) {
  return { id: row.id, company: row.company, name: row.name, email: row.email,
    status: row.disabled ? "Deactivated" : row.activated ? "Active" : row.ready ? "Awaiting activation" : "Setup incomplete",
    ...(row.sync_pending ? { airtableSyncPending: true } : {}),
    ...(row.sync_error ? { airtableSyncError: true } : {}),
  };
}

export function createStore(admin) {
  const table = () => admin.from("partner_registrations");
  return {
    async list() {
      const rows = check(await admin.rpc("list_partner_admin_accounts"), "Unable to load partners. Check the administration setup.");
      if (!rows.length) return rows;
      const jobs = check(await admin.from("partner_airtable_sync").select("registration_id,revision,synced_revision,last_error")
        .in("registration_id", rows.map((row) => row.id)), "Unable to check Airtable synchronization.");
      const byId = new Map(jobs.map((job) => [job.registration_id, job]));
      return rows.map((row) => {
        const job = byId.get(row.id);
        return { ...row, sync_pending: !!job && job.revision > job.synced_revision, sync_error: !!job?.last_error };
      });
    },
    async reserve(values) {
      const result = await table().upsert(values, { onConflict: "email", ignoreDuplicates: true });
      if (result.error?.code === "23505") throw new Failure("This partner name is already registered.", 409);
      check(result, "Unable to register this partner. Check the administration setup.");
      const row = check(await table().select("*").eq("email", values.email).single(), "Unable to read this partner.");
      if (row.company !== values.company || (!row.deleted_at && row.name !== values.name)) {
        throw new Failure("This email is already registered with different partner details.", 409);
      }
      return row;
    },
    async claim(id, token) {
      const now = Date.now();
      return check(await table().update({ lock_token: token, locked_until: new Date(now + 300000).toISOString() })
        .eq("id", id).or(`locked_until.is.null,locked_until.lt.${new Date(now).toISOString()}`)
        .select("*").maybeSingle(), "Unable to prepare this invitation.");
    },
    async save(id, token, values) {
      const row = check(await table().update(values).eq("id", id).eq("lock_token", token).select("*").maybeSingle(), "Unable to save partner setup. Generate the link again from the partner list to resume.");
      if (!row) throw new Failure("Partner setup is already in progress. Please refresh and try again.", 409);
      return row;
    },
    async membership(userId, partnerId) {
      check(await admin.from("partner_memberships").upsert({ user_id: userId, partner_id: partnerId }, { onConflict: "user_id", ignoreDuplicates: true }), "Unable to link partner access. Generate the link again to resume.");
      const row = check(await admin.from("partner_memberships").select("partner_id").eq("user_id", userId).single(), "Unable to verify partner access.");
      if (row.partner_id !== partnerId) throw new Failure("This account already belongs to another partner.", 409);
      check(await admin.from("partner_memberships").update({ enabled: true }).eq("user_id", userId).eq("partner_id", partnerId), "Unable to enable partner access. Generate the invitation again to resume.");
    },
    async setAccess(id, token, enabled) {
      const changed = check(await admin.rpc("set_partner_account_access", { p_id: id, p_token: token, p_enabled: enabled }), "Unable to change account access. Refresh the list and try again.");
      if (!changed) throw new Failure("Account access is already being changed. Please refresh and try again.", 409);
    },
    async release(id, token) {
      await table().update({ lock_token: null, locked_until: null }).eq("id", id).eq("lock_token", token);
    },
  };
}

async function findOwnedUser(auth, row, ignoreUnrelated = false) {
  // Recover safely if Auth succeeded but saving the user ID was interrupted.
  // Never attach an unrelated pre-existing account by email alone.
  for (let page = 1; ; page++) {
    const { users } = check(await auth.admin.listUsers({ page, perPage: 100 }), "Unable to verify an existing account.");
    const user = users.find((value) => value.email?.toLowerCase() === row.email);
    if (user) {
      if (user.app_metadata?.partner_registration_id !== row.id) {
        if (ignoreUnrelated) return null;
        throw new Failure("This email already has an account. Contact your administrator.", 409);
      }
      return user;
    }
    if (users.length < 100) return null;
  }
}

async function upsertAirtable(env, row, fetchImpl) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || "Partners")}`;
  const response = await fetchImpl(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["Portal ID"] }, records: [{ fields: { Name: row.company, "Portal ID": row.id } }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Failure("Unable to save the partner record. Generate the link again from the partner list to resume.");
  const body = await response.json();
  const partnerId = body.records?.[0]?.id;
  if (body.records?.length !== 1 || !recordId.test(partnerId)) throw new Failure("The partner record could not be verified.");
  return partnerId;
}

export function createPartnerAdminHandler({ env, admin, auth = admin?.auth, store = admin ? createStore(admin) : null, fetchImpl = fetch }) {
  return async (request) => {
    if (request.method === "OPTIONS") return json(null, 200);
    if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
    let claim;
    try {
      const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
      if (!bearer) throw new Failure("Please sign in to administer partners.", 401);
      if (!auth || !store) throw new Failure("Partner administration is not configured.", 503);
      const verification = await auth.getUser(bearer);
      if (verification.error || !verification.data?.user) throw new Failure("Please sign in again.", 401);
      if (verification.data.user.app_metadata?.role !== "partner_admin") throw new Failure("Administrator access is required.", 403);
      if (request.method === "GET") return json({ partners: (await store.list()).map(account) });

      const body = await request.json().catch(() => null);
      if (!body || !["create", "invite", "recovery", "disable", "enable", "delete"].includes(body.action)) throw new Failure("Invalid request.", 400);
      const lifecycle = ["disable", "enable", "delete"].includes(body.action);
      const recovering = body.action === "recovery";
      let portal;
      if (!lifecycle) {
        if (!env.PORTAL_URL || (!recovering && (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID))) throw new Failure("Partner access links are not configured. Contact your administrator.", 503);
        portal = new URL(env.PORTAL_URL);
        if (portal.protocol !== "https:" && !(portal.protocol === "http:" && ["localhost", "127.0.0.1"].includes(portal.hostname))) throw new Failure("The portal address is not configured correctly.", 503);
        portal.search = "";
        portal.hash = "";
      }
      let row;
      let contactName;
      if (body.action === "create") {
        const company = typeof body.company === "string" ? body.company.trim() : "";
        const name = typeof body.name === "string" ? body.name.trim() : "";
        contactName = name;
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!company || company.length > 160 || !name || name.length > 120 || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) throw new Failure("Enter a partner name, contact name and valid email address.", 400);
        row = await store.reserve({ company, name, email });
      } else {
        if (!uuid.test(body.id)) throw new Failure("Invalid partner.", 400);
        row = (await store.list()).find((value) => value.id === body.id);
        if (!row) throw new Failure("Partner not found.", 404);
      }
      if (!lifecycle && row.disabled && !row.deleted_at) throw new Failure("Reactivate this account before generating an access link.", 409);
      if (!lifecycle && !recovering && row.activated) throw new Failure("This account is already activated.", 409);
      if (recovering && (!row.activated || !row.ready)) throw new Failure("Only active accounts can receive a password reset link.", 409);
      const token = crypto.randomUUID();
      row = await store.claim(row.id, token);
      if (!row) throw new Failure("An invitation is already being prepared. Please refresh and try again.", 409);
      claim = { id: row.id, token };
      // Recheck activation after acquiring the lock, including create retries.
      const current = (await store.list()).find((value) => value.id === row.id);
      if (!lifecycle && !recovering && current?.activated) throw new Failure("This account is already activated.", 409);
      if (!lifecycle && !row.deleted_at && (row.disabled || current?.disabled)) throw new Failure("Reactivate this account before generating an access link.", 409);

      if (recovering) {
        if (row.deleted_at || !current?.activated || !row.ready || !row.user_id) throw new Failure("Only active accounts can receive a password reset link.", 409);
        const user = check(await auth.admin.getUserById(row.user_id), "Unable to verify the partner account.").user;
        if (!user || user.id !== row.user_id || user.email?.toLowerCase() !== row.email || user.app_metadata?.partner_registration_id !== row.id) throw new Failure("Partner account details could not be verified.", 409);
        if (user.id === verification.data.user.id || user.app_metadata?.role === "partner_admin") throw new Failure("Administrator recovery must be handled separately.", 403);
        if (!user.email_confirmed_at || (user.banned_until && new Date(user.banned_until).getTime() > Date.now())) throw new Failure("Only active accounts can receive a password reset link.", 409);
        const generated = check(await auth.admin.generateLink({ type: "recovery", email: row.email, options: { redirectTo: portal.toString() } }), "Unable to generate a password reset link. Please try again.");
        if (generated.user?.id !== row.user_id || !generated.properties?.hashed_token) throw new Failure("The password reset link could not be verified.");
        portal.searchParams.set("token_hash", generated.properties.hashed_token);
        portal.searchParams.set("type", "recovery");
        return json({ partner: account({ ...current, ...row }), link: portal.toString(), kind: "recovery" });
      }

      if (lifecycle) {
        if (row.deleted_at) throw new Failure("This account has already been deleted.", 409);
        let user;
        if (row.user_id) {
          const lookup = await auth.admin.getUserById(row.user_id);
          if (lookup.error && lookup.error.code !== "user_not_found" && lookup.error.status !== 404) throw new Failure("Unable to verify the partner account.");
          user = lookup.data?.user;
        } else {
          user = await findOwnedUser(auth, row, true);
          if (user) row = await store.save(row.id, token, { user_id: user.id });
        }
        if (user && (user.id === verification.data.user.id || user.app_metadata?.role === "partner_admin")) throw new Failure("Administrator accounts cannot be changed here.", 403);
        if (user && (user.id !== row.user_id || user.email?.toLowerCase() !== row.email || user.app_metadata?.partner_registration_id !== row.id)) throw new Failure("Partner account details could not be verified.", 409);
        if (body.action === "enable") {
          if (!user && row.ready) throw new Failure("This login no longer exists. Delete the user entry and register it again.", 409);
          if (user) check(await auth.admin.updateUserById(user.id, { ban_duration: "none" }), "Unable to reactivate this account. Please try again.");
          if (row.ready) await store.setAccess(row.id, token, true);
          else await store.save(row.id, token, { disabled: false });
          return json({ partner: account({ ...current, ...row, disabled: false }) });
        }
        // Revoke data access before banning/deleting. Failed Auth operations
        // remain closed to data access and may be safely retried.
        await store.setAccess(row.id, token, false);
        if (body.action === "disable") {
          if (user) check(await auth.admin.updateUserById(user.id, { ban_duration: "876000h" }), "Data access is blocked, but sign-in could not be disabled. Please retry deactivation.");
          return json({ partner: account({ ...current, ...row, disabled: true }) });
        }
        if (user) check(await auth.admin.deleteUser(user.id), "Data access is blocked, but the account could not be deleted. Please try again.");
        await store.save(row.id, token, { user_id: null, ready: false, disabled: true, deleted_at: new Date().toISOString() });
        return json({ deleted: true, id: row.id });
      }

      if (row.deleted_at) row = await store.save(row.id, token, { deleted_at: null, disabled: false, ready: false, name: contactName });

      let user;
      if (row.user_id) {
        user = check(await auth.admin.getUserById(row.user_id), "Unable to verify the partner account.").user;
        if (!user || user.email?.toLowerCase() !== row.email || user.app_metadata?.partner_registration_id !== row.id) throw new Failure("Partner account details could not be verified.", 409);
      } else {
        user = await findOwnedUser(auth, row);
        if (!user) {
          const created = await auth.admin.createUser({ email: row.email, user_metadata: { full_name: row.name }, app_metadata: { partner_registration_id: row.id } });
          if (created.error) {
            user = await findOwnedUser(auth, row);
            if (!user) throw new Failure("Unable to create the partner account. Generate the link again to retry.");
          } else user = created.data.user;
        }
        row = await store.save(row.id, token, { user_id: user.id });
      }
      if (!row.partner_id) row = await store.save(row.id, token, { partner_id: await upsertAirtable(env, row, fetchImpl) });
      await store.membership(row.user_id, row.partner_id);
      row = await store.save(row.id, token, { ready: true });
      // If a previous invitation was opened without setting a password, use recovery.
      const type = user.email_confirmed_at ? "recovery" : "invite";
      const generated = check(await auth.admin.generateLink({ type, email: row.email, options: { redirectTo: portal.toString() } }), "The partner was saved, but the link could not be generated. Try Generate invitation link in the partner list.");
      if (generated.user?.id !== row.user_id || !generated.properties?.hashed_token) throw new Failure("The invitation link could not be verified.");
      portal.searchParams.set("token_hash", generated.properties.hashed_token);
      portal.searchParams.set("type", type);
      return json({ partner: account({ ...row, activated: false }), link: portal.toString() });
    } catch (error) {
      return json({ error: error instanceof Failure ? error.message : "Unable to complete this request. Refresh the partner list before trying again." }, error instanceof Failure ? error.status : 502);
    } finally {
      if (claim) await store.release(claim.id, claim.token).catch(() => {});
    }
  };
}
