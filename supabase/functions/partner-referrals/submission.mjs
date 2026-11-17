import { findPartnerMembership } from "../_shared/partner-membership.mjs";
import { adminSessionValid } from "../_shared/admin-session.mjs";
const recordId = /^rec[A-Za-z0-9]{14}$/;
// Called only after the caller has been verified through Supabase Auth.
export async function readReferralSubmission({ request, env, user, admin, fetchImpl, json }) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!recordId.test(id || "")) return json({ error: "Invalid referral." }, 400);
    if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_REFERRALS_TABLE_ID) return json({ error: "Referral details are not configured." }, 503);
    const bearer = request.headers.get("authorization").replace(/^Bearer\s+/i, "");
    let partnerId;
    if (user.app_metadata?.role === "partner_admin") {
      if (!admin || !await adminSessionValid(admin, user.id, bearer)) return json({ error: "Please sign in again." }, 401);
    } else {
      partnerId = await findPartnerMembership({ projectUrl: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY, accessToken: bearer, userId: user.id, fetchImpl });
      if (!recordId.test(partnerId || "")) return json({ error: "An active partner account is required." }, 403);
    }
    const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
    const call = async url => {
      const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Details unavailable");
      return response.json();
    };
    const referral = await call(`${base}/${encodeURIComponent(env.AIRTABLE_REFERRALS_TABLE_ID)}/${id}`);
    const owners = referral.fields?.Partner;
    if (referral.id !== id || !Array.isArray(owners) || owners.length !== 1 || !recordId.test(owners[0])) throw new Error("Invalid referral");
    if (partnerId && owners[0] !== partnerId) return json({ error: "Referral not found." }, 404);
    const linked = referral.fields["Referral submissions"] ?? [];
    if (!Array.isArray(linked) || linked.length > 1 || linked.some(value => !recordId.test(value))) throw new Error("Invalid form links");
    if (!linked.length) return json({ submission: null });
    const form = await call(`${base}/${encodeURIComponent(env.AIRTABLE_REFERRAL_FORM_TABLE_ID || "referrals_form_api")}/${linked[0]}`);
    // Check both sides of the relationship before exposing any intake data.
    if (form.id !== linked[0] || form.fields?.Referral?.length !== 1 || form.fields.Referral[0] !== id || form.fields?.Partner?.length !== 1 || form.fields.Partner[0] !== owners[0]) throw new Error("Mismatched form");
    const text = name => typeof form.fields[name] === "string" ? form.fields[name] : "";
    return json({ submission: { firstName: text("First name"), lastName: text("Last name"), phone: text("Phone"), interests: Array.isArray(form.fields["Business interests"]) ? form.fields["Business interests"].filter(value => typeof value === "string") : [] } });
  } catch {
    return json({ error: "Unable to load form details. Please try again." }, 502);
  }
}
