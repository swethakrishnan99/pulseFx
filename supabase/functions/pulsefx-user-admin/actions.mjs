export function administratorAccount(row) {
  return { id: row.id, name: row.name || "", email: row.email, role: "partner_admin", supabaseId: row.id,
    createdAt: row.created_at || null, status: row.disabled ? "Deactivated" : row.activated ? "Active" : "Awaiting activation" };
}

export async function manageAdministrator({ body, actor, auth, store, env, Failure, check, audit }) {
  const action = body.action;
  if (!["edit", "invite", "recovery", "enable", "disable", "delete"].includes(action)
    || typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)) throw new Failure("Invalid administrator action.", 400);
  if (body.id === actor.id && ["disable", "delete"].includes(action)) {
    throw new Failure("You cannot deactivate or delete your own account.", 403);
  }
  let portal;
  if (["invite", "recovery"].includes(action)) {
    if (!env.PORTAL_URL) throw new Failure("Administrator access links are not configured.", 503);
    portal = new URL(env.PORTAL_URL);
    if (portal.protocol !== "https:" && !(portal.protocol === "http:" && ["localhost", "127.0.0.1"].includes(portal.hostname))) throw new Failure("The portal address is not configured correctly.", 503);
    portal.search = ""; portal.hash = "";
  }
  const token = crypto.randomUUID();
  if (!await store.claimAdminAction(actor.id, token)) throw new Failure("Another administrator action is in progress. Please try again.", 409);
  try {
    const row = (await store.listAdmins()).find((entry) => entry.id === body.id);
    if (!row) throw new Failure("Administrator not found.", 404);
    const user = check(await auth.admin.getUserById(row.id), "Unable to verify this administrator.").user;
    if (!user || user.id !== row.id || user.app_metadata?.role !== "partner_admin" || user.email?.toLowerCase() !== row.email?.toLowerCase()
      || user.app_metadata?.partner_registration_id) throw new Failure("Administrator details could not be verified.", 409);
    if (["disable", "delete"].includes(action) && row.activated && !row.disabled
      && (await store.listAdmins()).filter((entry) => entry.activated && !entry.disabled).length <= 1) {
      throw new Failure("The last active administrator cannot be deactivated or deleted.", 409);
    }
    if (["invite", "recovery"].includes(action)) {
      if (row.disabled || (user.banned_until && new Date(user.banned_until).getTime() > Date.now())) throw new Failure("Reactivate this administrator before generating an access link.", 409);
      if (action === "recovery" ? !row.activated : row.activated) throw new Failure(action === "recovery" ? "Only active administrators can receive password reset links." : "This administrator is already activated.", 409);
      const type = action === "recovery" || user.email_confirmed_at ? "recovery" : "invite";
      const generated = check(await auth.admin.generateLink({ type, email: user.email, options: { redirectTo: portal.toString() } }), "Unable to generate the administrator access link.");
      if (generated.user?.id !== user.id || generated.user.app_metadata?.role !== "partner_admin" || !generated.properties?.hashed_token) throw new Failure("The administrator link could not be verified.");
      portal.searchParams.set("token_hash", generated.properties.hashed_token); portal.searchParams.set("type", type);
      return { administrator: administratorAccount(row), link: portal.toString(), ...(type === "recovery" ? { kind: "recovery" } : {}) };
    }
    if (action === "edit") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!name || name.length > 120 || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) throw new Failure("Enter a name and valid email address.", 400);
      if (body.expected?.name !== row.name || body.expected?.email !== row.email) throw new Failure("Administrator details changed. Refresh and try again.", 409);
      const emailChanged = email !== row.email;
      if (emailChanged && row.id === actor.id) throw new Failure("Ask another administrator to update your login email.", 403);
      if (emailChanged && body.confirmEmailChange !== true) throw new Failure("Confirm that the new email belongs to the same administrator.", 400);
      if (emailChanged && await store.partnerEmailExists(email)) throw new Failure("This email belongs to a partner.", 409);
      if (emailChanged) await store.invalidateAdminCredentials(row.id, token);
      const attributes = { user_metadata: { ...user.user_metadata, full_name: name }, ...(emailChanged ? { email, email_confirm: !!user.email_confirmed_at } : {}) };
      const result = await auth.admin.updateUserById(row.id, attributes);
      if (result.error) throw new Failure("Unable to update the administrator. Check whether the email is already registered, then refresh and try again.", 409);
      const updated = result.data?.user;
      if (updated?.id !== row.id || updated.email?.toLowerCase() !== email || updated.user_metadata?.full_name !== name || updated.app_metadata?.role !== "partner_admin") throw new Failure("The update could not be verified. Refresh before trying again.");
      if (emailChanged) await store.invalidateAdminCredentials(row.id, token);
      return { administrator: administratorAccount({ ...row, name, email }), emailChanged };
    }
    if (action === "delete") {
      // Ban and revoke before deletion; a failed delete stays safely deactivated.
      check(await auth.admin.updateUserById(row.id, { ban_duration: "876000h" }), "Unable to block administrator access before deletion.");
      await store.invalidateAdminCredentials(row.id, token);
      check(await auth.admin.deleteUser(row.id), "Administrator access is blocked, but deletion failed. Refresh and retry.");
      return { deleted: true, id: row.id };
    }
    check(await auth.admin.updateUserById(row.id, { ban_duration: action === "enable" ? "none" : "876000h" }), "Unable to change administrator access.");
    if (action === "disable") {
      await audit?.record("admin", row.id, "deactivated", actor);
      await store.invalidateAdminCredentials(row.id, token);
    }
    if (action === "enable") await audit?.reactivate("admin", row.id);
    return { administrator: administratorAccount({ ...row, disabled: action !== "enable" }) };
  } finally { await store.releaseAdminAction(token).catch(() => {}); }
}
