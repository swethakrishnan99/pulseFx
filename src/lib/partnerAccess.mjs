class AccessFlowError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** One verification per page instance, including React Strict Mode effect replay. */
export function createPartnerAccessFlow(client, invitation) {
  let verification;
  let lastResult;
  let saving = false;
  let finished = false;
  function verify({ retry = false } = {}) {
    if (retry && lastResult?.reason === "unavailable") verification = undefined;
    if (!verification) {
      verification = (async () => {
        try {
          const result = await client.auth.verifyOtp(invitation);
          if (result.error) {
            const unavailable = result.error.name === "AuthRetryableFetchError" || result.error.status === 0 || result.error.status >= 500;
            return { valid: false, reason: unavailable ? "unavailable" : "invalid" };
          }
          return result.data?.session ? { valid: true } : { valid: false, reason: "invalid" };
        } catch { return { valid: false, reason: "unavailable" }; }
      })().then((result) => { lastResult = result; return result; });
    }
    return verification;
  }
  return {
    verify,
    async savePassword(password) {
      if (finished) throw new AccessFlowError("already_completed");
      if (saving) throw new AccessFlowError("in_progress");
      saving = true;
      try {
        if (!(await verify()).valid) throw new AccessFlowError("invalid_link");
        const permission = await client.rpc("partner_portal_session_valid");
        if (permission.error) throw new AccessFlowError("access_unavailable");
        if (permission.data !== true) throw new AccessFlowError("session_expired");
        const result = await client.auth.updateUser({ password });
        if (result.error) {
          if (result.error.status === 401 || ["session_not_found", "bad_jwt", "user_banned", "user_not_found"].includes(result.error.code)) throw new AccessFlowError("session_expired");
          throw new AccessFlowError(result.error.code === "same_password" ? "same_password" : "password_rejected");
        }
        finished = true;
        // A successful password change remains successful even if logout is offline.
        try { await client.auth.signOut({ scope: invitation.type === "recovery" ? "global" : "local" }); } catch { /* No session is persisted by this client. */ }
      } finally { saving = false; }
    },
  };
}
