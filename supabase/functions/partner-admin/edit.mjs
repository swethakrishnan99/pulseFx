export async function editPartner({ body, row, current, store, auth, actor, Failure, check, account }) {
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const allowed = ["action", "id", "company", "name", "email", "expected", "confirmEmailChange"];
  if (Object.keys(body).some((key) => !allowed.includes(key)) || !company || company.length > 160 || !name || name.length > 120 || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || !body.expected ||
      Object.keys(body.expected).sort().join(',') !== 'company,email,name' || Object.values(body.expected).some((value) => typeof value !== 'string')) throw new Failure("Enter a partner name, contact name and valid email address.", 400);
  if (!row.ready || !row.user_id || !row.partner_id || row.deleted_at) throw new Failure("Complete partner setup before editing.", 409);
  const user = check(await auth.admin.getUserById(row.user_id), "Unable to verify the partner account.").user;
  if (!user || user.id !== row.user_id || user.app_metadata?.partner_registration_id !== row.id ||
      ![row.email, current?.previous_email].filter(Boolean).includes(user.email?.toLowerCase())) throw new Failure("Partner account details could not be verified.", 409);
  if (user.id === actor.id || user.app_metadata?.role === "partner_admin") throw new Failure("Administrator accounts cannot be edited here.", 403);
  const previousEmail = current?.previous_email || row.email;
  if (email !== previousEmail && body.confirmEmailChange !== true) throw new Failure("Confirm that the new email belongs to this same contact.", 400);
  for (let page = 1; ; page++) {
    const { users } = check(await auth.admin.listUsers({ page, perPage: 100 }), "Unable to check the new email.");
    if (users.some((candidate) => candidate.id !== row.user_id && candidate.email?.toLowerCase() === email)) throw new Failure("This email is already registered to another user.", 409);
    if (users.length < 100) break;
  }
  const change = await store.prepareEdit(row.id, row.lock_token, actor.id, { company, name, email }, body.expected, body.confirmEmailChange === true);
  const emailChanged = change.before.email !== email;
  // Keep passwords, registration ownership, account IDs and bans untouched.
  const attributes = { user_metadata: { ...user.user_metadata, full_name: name } };
  if (user.email?.toLowerCase() !== email) {
    attributes.email = email;
    attributes.email_confirm = !!user.email_confirmed_at;
  }
  let updated;
  try {
    const result = await auth.admin.updateUserById(row.user_id, attributes);
    if (result.error) throw new Error('Auth update failed');
    updated = result.data?.user;
  } catch {
    // A timed-out request may have succeeded. Inspect Auth before resuming or rolling back.
    const lookup = await auth.admin.getUserById(row.user_id);
    updated = lookup.data?.user;
    if (!updated || lookup.error) throw new Failure("The update is pending. Use Edit to resume it before changing account access.");
    if (updated.email?.toLowerCase() === change.before.email && updated.email?.toLowerCase() !== email) {
      await store.cancelEdit(row.id, row.lock_token, actor.id);
      throw new Failure("The email could not be updated. The original profile was restored. Please try again.");
    }
  }
  if (updated?.id !== row.user_id || updated.email?.toLowerCase() !== email || updated.user_metadata?.full_name !== name) throw new Failure("The update is pending. Use Edit to resume it before changing account access.");
  await store.finishEdit(row.id, row.lock_token, actor.id);
  const refreshed = (await store.list()).find((value) => value.id === row.id);
  if (!refreshed || refreshed.profile_edit_pending) throw new Failure("The update is pending. Refresh and resume it from Edit.");
  return { partner: account(refreshed), emailChanged, newInvitationRequired: emailChanged && !refreshed.activated };
}
