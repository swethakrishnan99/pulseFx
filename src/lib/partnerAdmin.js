import { supabase } from "./supabase";

async function request(method, body, signal, functionName = "partner-admin") {
  if (!supabase) throw new Error("Partner administration is not configured.");
  const { data, error } = await supabase.functions.invoke(functionName, { method, body, signal });
  if (error) {
    let message = "Unable to complete this request. Please try again.";
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === "string") message = response.error;
    }
    throw new Error(message);
  }
  return data;
}

export async function listPartners(signal) {
  const data = await request("GET", undefined, signal);
  if (!Array.isArray(data?.partners)) throw new Error("Unable to load partners.");
  return data.partners;
}

export async function createPartner(partner) {
  const data = await request("POST", { action: "create", ...partner }, undefined, "partner-invitations");
  if (!data?.partner || data.emailQueued !== true) throw new Error("Invitation delivery could not be confirmed. Refresh the partner list before trying again.");
  return data;
}

export async function generatePartnerInvite(id) {
  const data = await request("POST", { action: "invite", id });
  if (!data?.partner || !data?.link) throw new Error("The invitation link could not be generated. Please try again.");
  return data;
}

export async function generatePartnerRecovery(id) {
  const data = await request("POST", { action: "recovery", id });
  if (!data?.partner || !data?.link || data.kind !== "recovery") throw new Error("The password reset link could not be generated. Please try again.");
  return data;
}

export async function changePartnerAccess(id, enabled) {
  const data = await request("POST", { action: enabled ? "enable" : "disable", id });
  if (!data?.partner) throw new Error("Account access could not be updated. Refresh the list before trying again.");
  return data.partner;
}

export async function deletePartnerUser(id) {
  const data = await request("POST", { action: "delete", id });
  if (!data?.deleted || data.id !== id) throw new Error("Account deletion could not be confirmed. Refresh the list before trying again.");
}

export async function editPartnerProfile(details) {
  const data = await request("POST", { action: "edit", ...details });
  if (!data?.partner?.id) throw new Error("Unable to confirm the update. Refresh the partner list before trying again.");
  return data;
}

export async function loadPartnerAirtableDetails(id, signal) {
  const data = await request("GET", undefined, signal, `partner-admin?referralUrlFor=${encodeURIComponent(id)}`);
  if (typeof data?.referralUrl !== "string") throw new Error("Unable to load the referral URL.");
  return { url: data.referralUrl, role: typeof data.partnerRole === "string" ? data.partnerRole : "" };
}
