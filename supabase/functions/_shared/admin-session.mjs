// The caller must verify the bearer token with Auth before using its session ID.
export async function adminSessionValid(admin, userId, bearer) {
  let sessionId;
  try {
    sessionId = JSON.parse(atob(bearer.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).session_id;
  } catch { return false; }
  if (typeof sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return false;
  const result = await admin.rpc("portal_admin_session_valid", { p_user_id: userId, p_session_id: sessionId });
  if (result.error) throw new Error("Unable to verify administrator session.");
  return result.data === true;
}
