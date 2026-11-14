// Only called after verifying the caller's server-managed administrator role.
export async function createAdministrator({ body, actor, auth, store, env, Failure, check }) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name || name.length > 120 || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || body.confirmAdmin !== true) {
    throw new Failure("Enter a name, valid email and confirm administrator access.", 400);
  }
  if (!env.PORTAL_URL) throw new Failure("Administrator invitations are not configured.", 503);
  const portal = new URL(env.PORTAL_URL);
  if (portal.protocol !== "https:" && !(portal.protocol === "http:" && ["localhost", "127.0.0.1"].includes(portal.hostname))) {
    throw new Failure("The portal address is not configured correctly.", 503);
  }
  portal.search = "";
  portal.hash = "";
  if (await store.partnerEmailExists(email)) {
    throw new Failure("This email belongs to a partner. Use a separate email for administrator access.", 409);
  }
  async function findUser() {
    for (let page = 1; ; page++) {
      const { users } = check(await auth.admin.listUsers({ page, perPage: 100 }), "Unable to check existing accounts.");
      const user = users.find((entry) => entry.email?.toLowerCase() === email);
      if (user) return user;
      if (users.length < 100) return null;
    }
  }
  let user = await findUser();
  if (!user) {
    const created = await auth.admin.createUser({
      email, user_metadata: { full_name: name },
      app_metadata: { role: "partner_admin", admin_invited_by: actor.id },
    });
    if (created.error) {
      // A concurrent request or timed-out creation may already have saved Auth.
      user = await findUser();
      if (!user) throw new Failure("Unable to create the administrator. Retry with the same email.");
    } else user = created.data?.user;
  }
  // Only resume admins created by this caller through this flow. Never promote
  // existing Auth accounts, reset the caller or revive a blocked administrator.
  if (!user?.id || user.email?.toLowerCase() !== email || user.id === actor.id
    || user.app_metadata?.role !== "partner_admin" || user.app_metadata?.admin_invited_by !== actor.id
    || user.app_metadata?.partner_registration_id) {
    throw new Failure("This email already has an account. Existing accounts cannot be changed from Add admin.", 409);
  }
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    throw new Failure("This administrator is deactivated.", 409);
  }
  const type = user.email_confirmed_at ? "recovery" : "invite";
  const generated = check(await auth.admin.generateLink({ type, email, options: { redirectTo: portal.toString() } }),
    "The administrator was created, but the link could not be generated. Retry Add admin with the same email.");
  if (generated.user?.id !== user.id || generated.user?.app_metadata?.role !== "partner_admin" || !generated.properties?.hashed_token) {
    throw new Failure("The administrator link could not be verified. Retry with the same email.");
  }
  portal.searchParams.set("token_hash", generated.properties.hashed_token);
  portal.searchParams.set("type", type);
  return { administrator: { id: user.id, name: user.user_metadata?.full_name || name, email, role: "partner_admin" },
    link: portal.toString(), ...(type === "recovery" ? { kind: "recovery" } : {}) };
}
