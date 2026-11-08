import { supabase } from "./supabase";

export async function loadPartnerReferrals({ signal } = {}) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("referrals", { method: "GET", signal });
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
