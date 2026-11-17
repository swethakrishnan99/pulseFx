import { readReferrals } from "../partner-referrals/service.mjs";
import { referralEmailConflict } from "../_shared/referral-duplicates.mjs";
import { findPartnerMembership } from "../_shared/partner-membership.mjs";
import { BUSINESS_INTERESTS } from "../_shared/referral-form-fields.mjs";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const recordId = /^rec[A-Za-z0-9]{14}$/;
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");
export async function referralToken(partnerId, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `${partnerId}.${hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`partner-referral:v1:${partnerId}`)))}`;
}
async function validToken(token, secret) {
  if (typeof token !== "string" || !/^rec[A-Za-z0-9]{14}\.[a-f0-9]{64}$/.test(token)) return null;
  const id = token.split(".")[0];
  const expected = await referralToken(id, secret);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ token.charCodeAt(index);
  return difference === 0 ? id : null;
}
export function validateSubmission(input) {
  const allowed = ["action", "token", "submissionId", "firstName", "lastName", "company", "email", "phone", "interests", "website", "confirmedRejection"];
  if (Object.keys(input).some(key => !allowed.includes(key))) return null;
  if (input.confirmedRejection !== undefined) {
    const confirmation = input.confirmedRejection;
    if (!confirmation || typeof confirmation !== "object" || Array.isArray(confirmation) || Object.keys(confirmation).some(key => !["id", "statusChangedAt"].includes(key)) || !recordId.test(confirmation.id || "") || typeof confirmation.statusChangedAt !== "string") return null;
  }
  const result = {};
  for (const [name, length, required] of [["firstName", 100, true], ["lastName", 100, true], ["company", 200, false], ["email", 254, true], ["phone", 60, false]]) {
    const value = input[name] ?? "";
    if (typeof value !== "string" || value.length > length || (required && !value.trim())) return null;
    result[name] = value.trim();
  }
  result.email = result.email.toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(result.email) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.submissionId || "") ||
      !Array.isArray(input.interests) || input.interests.length > 4 || new Set(input.interests).size !== input.interests.length || input.interests.some(value => !BUSINESS_INTERESTS.includes(value)) || typeof (input.website ?? "") !== "string" || input.website) return null;
  return { ...result, confirmedRejection: input.confirmedRejection, interests: input.interests, submissionId: input.submissionId };
}
export function createReferralFormHandler({ env, admin, fetchImpl = fetch }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    if (!admin || !env.SUPABASE_URL || !key || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_REFERRALS_TABLE_ID || !env.PORTAL_URL || (env.PARTNER_REFERRAL_LINK_SECRET || "").length < 32) return json({ error: "Referral links are not configured yet." }, 503);
    let writing = false;
    try {
      const reader = request.body?.getReader();
      const decoder = new TextDecoder(); let raw = "", size = 0;
      if (reader) while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 8000) { await reader.cancel(); return json({ error: "Request is too large." }, 413); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      let input;
      try { input = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
      if (!input || Array.isArray(input) || typeof input !== "object" || !["link", "load", "submit"].includes(input.action)) return json({ error: "Invalid request." }, 400);
      const call = (url, options = {}) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
      const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
      const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
      let partnerId;
      if (input.action === "link") {
        if (Object.keys(input).some(key => key !== "action")) return json({ error: "Invalid request." }, 400);
        const authorization = request.headers.get("authorization") || "";
        if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ error: "Please sign in." }, 401);
        const auth = await call(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
        if (!auth.ok) return json({ error: "Please sign in again." }, 401);
        const user = await auth.json();
        if (!user.id || (user.banned_until && Date.parse(user.banned_until) > Date.now())) return json({ error: "Please sign in again." }, 401);
        partnerId = await findPartnerMembership({ projectUrl: env.SUPABASE_URL, publishableKey: key, accessToken: authorization.replace(/^Bearer\s+/i, ""), userId: user.id, fetchImpl: call });
        if (!recordId.test(partnerId || "")) return json({ error: "An active partner account is required." }, 403);
      } else {
        if (input.action === "load" && Object.keys(input).some(key => !["action", "token"].includes(key))) return json({ error: "Invalid request." }, 400);
        partnerId = await validToken(input.token, env.PARTNER_REFERRAL_LINK_SECRET);
        if (!partnerId) return json({ error: "This referral link is invalid or unavailable." }, 404);
        const membership = await admin.from("partner_memberships").select("partner_id").eq("partner_id", partnerId).eq("enabled", true).limit(1);
        if (membership.error) throw new Error("Membership unavailable");
        if (!membership.data?.length) return json({ error: "This referral link is invalid or unavailable." }, 404);
      }
      const partnerUrl = `${base}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || "Partners_api")}/${partnerId}`;
      const response = await call(partnerUrl, { headers });
      if (!response.ok) throw new Error("Partner unavailable");
      const partner = await response.json();
      if (partner.id !== partnerId || typeof partner.fields?.Name !== "string" || !partner.fields.Name.trim()) throw new Error("Invalid partner");
      const link = new URL(env.PORTAL_URL);
      if (!["http:", "https:"].includes(link.protocol)) throw new Error("Invalid portal URL");
      link.search = ""; link.hash = "";
      link.searchParams.set("ref", await referralToken(partnerId, env.PARTNER_REFERRAL_LINK_SECRET));
      if (input.action === "link") {
        if (partner.fields["Referral URL"] !== link.href) {
          const saved = await call(partnerUrl, { method: "PATCH", headers, body: JSON.stringify({ fields: { "Referral URL": link.href } }) });
          if (!saved.ok) throw new Error("Link save failed");
        }
        return json({ url: link.href });
      }
      if (partner.fields["Referral URL"] !== link.href) return json({ error: "This referral link is invalid or unavailable." }, 404);
      if (input.action === "load") return json({ partner: { name: partner.fields.Name.trim() } });
      const values = validateSubmission(input);
      if (!values) return json({ error: "Enter your first name, last name, a valid email and valid business interests." }, 400);
      const referrals = await readReferrals({ env, partnerId, fetchImpl: call });
      const { blocked, rejection } = referralEmailConflict(referrals, values.email);
      if (blocked) return json({ error: "A referral already exists for this email. Please contact the PulseFX team before submitting again." }, 409);
      if (rejection && (values.confirmedRejection?.id !== rejection.id || values.confirmedRejection?.statusChangedAt !== rejection.statusChangedAt)) {
        return json({ code: "rejection_confirmation_required", rejection, error: "A previous referral for this email was rejected. Confirm whether you want to continue." }, 409);
      }
      // Durable rate limits and submission IDs work across edge instances and retries.
      const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const clientHash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.PARTNER_REFERRAL_LINK_SECRET}:${address}`)));
      const claim = await admin.rpc("claim_partner_referral_submission", { p_submission_id: values.submissionId, p_partner_id: partnerId, p_client_hash: clientHash });
      if (claim.error) throw new Error("Submission gate unavailable");
      if (claim.data === "duplicate") return json({ error: "This submission has already been received. Please contact PulseFX if you need help." }, 409);
      if (claim.data !== "accepted") return json({ error: "Too many requests. Please try again later." }, 429);
      writing = true;
      // Save the full intake first. If referral creation fails, the unlinked
      // form record remains available for reconciliation without losing input.
      const intake = await call(`${base}/${encodeURIComponent(env.AIRTABLE_REFERRAL_FORM_TABLE_ID || "referrals_form_api")}`, { method: "POST", headers, body: JSON.stringify({ records: [{ fields: {
        Partner: [partnerId], Company: values.company, Email: values.email,
        "First name": values.firstName, "Last name": values.lastName, Phone: values.phone,
        "Business interests": values.interests, "Submission ID": values.submissionId,
      } }] }) });
      if (!intake.ok) throw new Error("Form save failed");
      const intakeResult = await intake.json();
      const intakeId = intakeResult.records?.[0]?.id;
      if (!recordId.test(intakeId || "")) throw new Error("Invalid form save");
      // Airtable maintains the reciprocal Referral link on the intake record.
      const saved = await call(`${base}/${encodeURIComponent(env.AIRTABLE_REFERRALS_TABLE_ID)}`, { method: "POST", headers, body: JSON.stringify({ records: [{ fields: {
        Partner: [partnerId], Company: values.company, Contact: `${values.firstName} ${values.lastName}`,
        Email: values.email, Source: "Referral Link", Status: "Invited", "Referral submissions": [intakeId],
      } }] }) });
      if (!saved.ok) throw new Error("Referral save failed");
      const result = await saved.json();
      if (!recordId.test(result.records?.[0]?.id || "")) throw new Error("Invalid save");
      return json({ submitted: true }, 201);
    } catch {
      return json({ error: writing ? "We could not confirm your submission. Please contact PulseFX before submitting again." : "Unable to load the referral form. Please try again." }, 502);
    }
  };
}
