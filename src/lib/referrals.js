import { supabase } from "./supabase";

export async function loadPartnerReferrals({ signal } = {}) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("partner-referrals", { method: "GET", signal });
  if (error) {
    let message = "Unable to load referrals. Please try again.";
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
    }
    throw new Error(message);
  }
  if (!Array.isArray(data?.referrals)) throw new Error("Unable to load referrals. Please try again.");
  return data.referrals;
}

export async function createPartnerReferral(details) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("partner-referrals", { method: "POST", body: details });
  if (error) {
    let message = "Unable to confirm the client was saved. Check Referrals before trying again.";
    let rejection;
    let duplicate = false;
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
      if (body?.code === "rejection_confirmation_required" && body.rejection &&
          typeof body.rejection.id === "string" && typeof body.rejection.statusChangedAt === "string") rejection = body.rejection;
      duplicate = error.context.status === 409 && !rejection;
    }
    const failure = new Error(message);
    failure.rejection = rejection;
    failure.duplicate = duplicate;
    throw failure;
  }
  if (!data?.referral?.id) throw new Error("Unable to confirm the client was saved. Check Referrals before trying again.");
  return data.referral;
}

export async function loadPartnerProfile(signal) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.rpc("get_partner_display_profile").abortSignal(signal);
  if (error || typeof data?.name !== "string" || !data.name.trim()) throw new Error("Unable to load partner profile.");
  return data;
}

async function adminReferralRequest(method, body, signal) {
  if (!supabase) throw new Error("Administrator sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("partner-referrals?view=admin", { method, body, signal });
  if (error) {
    let message = method === "POST" ? "Unable to confirm the status was saved. Close the details and refresh before trying again." : "Unable to load referrals. Please try again.";
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === "string") message = response.error;
    }
    throw new Error(message);
  }
  return data;
}
export async function loadAdminReferrals(signal) {
  const data = await adminReferralRequest("GET", undefined, signal);
  if (!Array.isArray(data?.referrals)) throw new Error("Unable to load referrals.");
  return data.referrals;
}
export async function updateReferralStatus(referral, status) {
  const data = await adminReferralRequest("POST", { id: referral.id, status, expectedStatus: referral.status, expectedModifiedAt: referral.modifiedAt });
  if (!data?.referral?.id) throw new Error("Unable to confirm the status was saved. Close the details and refresh before trying again.");
  return data.referral;
}

export async function loadReferralSubmission(id, signal) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke(`partner-referrals?view=submission&id=${encodeURIComponent(id)}`, { method: "GET", signal });
  if (error || !data || !("submission" in data)) throw new Error("Unable to load form details. Please try again.");
  return data.submission;
}
