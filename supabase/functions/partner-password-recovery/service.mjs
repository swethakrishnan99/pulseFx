const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const accepted = () => json({ accepted: true }, 202);
export function createRecoveryHandler({ env, admin, fetchImpl = fetch }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (!admin || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_RECOVERY_TABLE_ID || !env.PORTAL_URL) return json({ error: "Password recovery is not configured. Please contact support." }, 503);
    let claim;
    try {
      const raw = await request.text();
      if (raw.length > 1024) return json({ error: "Request is too large." }, 413);
      const input = JSON.parse(raw);
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "email") || typeof input.email !== "string" || input.email.length > 254 || !/^\S+@\S+\.\S+$/.test(input.email.trim())) return json({ error: "Enter a valid email address." }, 400);
      const email = input.email.trim().toLowerCase();
      const portal = new URL(env.PORTAL_URL);
      if (portal.protocol !== "https:" && !(portal.protocol === "http:" && ["localhost", "127.0.0.1"].includes(portal.hostname))) throw new Error("Invalid portal URL");
      portal.search = "";
      portal.hash = "";
      const table = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_RECOVERY_TABLE_ID)}`;
      const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
      const call = (url, options) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
      async function recordUnavailable(status, reason, row) {
        const response = await call(table, { method: "POST", headers, body: JSON.stringify({ fields: {
          Email: email, "Requested at": new Date().toISOString(), Source: "Partner Login Page",
          Status: status, Error: reason,
          ...(row?.user_id ? { "Supabase user ID": row.user_id } : {}),
          ...(row?.partner_id ? { "Partner Airtable ID": row.partner_id } : {}),
        } }) });
        if (!response.ok) throw new Error("Recovery audit write failed");
        return accepted();
      }
      const found = await admin.from("partner_registrations").select("*").eq("email", email).maybeSingle();
      if (found.error) throw new Error("Lookup failed");
      const row = found.data;
      if (!row) return await recordUnavailable("Account not found", "No partner account was found for the submitted email address.");
      if (!row.ready || row.disabled || row.deleted_at || row.profile_edit_pending || !row.user_id) {
        const reason = row.deleted_at ? "The partner login has been deleted." : row.disabled ? "The partner account is deactivated." : row.profile_edit_pending ? "The partner account has a pending profile update." : "The partner account setup is incomplete.";
        return await recordUnavailable("Account inactive", reason, row);
      }
      const verified = await admin.auth.admin.getUserById(row.user_id);
      if (verified.error) throw new Error("User lookup failed");
      const user = verified.data?.user;
      if (!user || user.id !== row.user_id || user.email?.toLowerCase() !== email || user.app_metadata?.partner_registration_id !== row.id || user.app_metadata?.role === "partner_admin" || !user.email_confirmed_at || (user.banned_until && Date.parse(user.banned_until) > Date.now())) return await recordUnavailable("Account inactive", "The Auth account is not eligible for partner password recovery: identity mismatch, administrator account, unconfirmed email or suspended login.", row);
      const membership = await admin.from("partner_memberships").select("partner_id,enabled").eq("user_id", user.id).maybeSingle();
      if (membership.error) throw new Error("Membership lookup failed");
      if (!membership.data?.enabled || membership.data.partner_id !== row.partner_id) return await recordUnavailable("Account inactive", "The partner membership is missing, disabled or does not match this account.", row);
      const token = crypto.randomUUID();
      const locked = await admin.from("partner_registrations").update({ lock_token: token, locked_until: new Date(Date.now() + 300000).toISOString() }).eq("id", row.id).or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`).select("id").maybeSingle();
      if (locked.error) throw new Error("Lock failed");
      if (!locked.data) return accepted();
      claim = { id: row.id, token };
      const recent = new URL(table);
      recent.searchParams.set("filterByFormula", `AND({Supabase user ID}='${user.id}',IS_AFTER({Requested at},DATEADD(NOW(),-5,'minutes')))`);
      recent.searchParams.set("maxRecords", "1");
      const prior = await call(recent, { headers });
      if (!prior.ok) throw new Error("Request lookup failed");
      if ((await prior.json()).records?.length) return accepted();
      const generated = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: portal.toString() } });
      if (generated.error || generated.data?.user?.id !== row.user_id || !generated.data?.properties?.hashed_token) throw new Error("Recovery failed");
      portal.searchParams.set("token_hash", generated.data.properties.hashed_token);
      portal.searchParams.set("type", "recovery");
      const response = await call(table, { method: "POST", headers, body: JSON.stringify({ fields: {
        Email: email, "Recovery link": portal.toString(), "Requested at": new Date().toISOString(),
        "Supabase user ID": user.id, "Partner Airtable ID": row.partner_id, Source: "Partner Login Page", Status: "Pending",
      } }) });
      if (!response.ok) throw new Error("Queue write failed");
      return accepted();
    } catch (error) {
      if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
      return json({ error: "We could not confirm your recovery request. Check your inbox or contact support before trying again." }, 502);
    } finally {
      if (claim) {
        try { await admin.from("partner_registrations").update({ lock_token: null, locked_until: null }).eq("id", claim.id).eq("lock_token", claim.token); } catch { /* Lock expires automatically. */ }
      }
    }
  };
}
