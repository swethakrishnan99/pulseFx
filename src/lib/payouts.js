import { supabase } from "./supabase";

async function request(method, body, view, signal, params = {}) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const query = new URLSearchParams({ ...(view ? { view } : {}), ...params }).toString();
  const { data, error } = await supabase.functions.invoke(`partner-payouts${query ? `?${query}` : ""}`, { method, body, signal });
  if (error) {
    let message = method === "POST" ? "Unable to confirm the payout was saved. Refresh before trying again." : "Unable to load payouts. Please try again.";
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === "string") message = response.error;
    }
    throw new Error(message);
  }
  return data;
}
export async function loadPayouts(signal) {
  const data = await request("GET", undefined, undefined, signal);
  if (!Array.isArray(data?.payouts)) throw new Error("Unable to load payouts.");
  return data.payouts;
}
export async function loadAdminPayouts(signal) {
  const data = await request("GET", undefined, "admin", signal);
  if (!Array.isArray(data?.payouts) || !Array.isArray(data?.partners)) throw new Error("Unable to load payouts.");
  return data;
}
export async function saveAdminPayout(details) {
  const data = await request("POST", details, "admin");
  if (!data?.payout?.id) throw new Error("The payout could not be confirmed. Refresh before trying again.");
  return data.payout;
}
export async function loadPayoutReferrals(partnerId, signal) {
  const data = await request("GET", undefined, "admin", signal, { partnerId });
  if (!Array.isArray(data?.referrals)) throw new Error("Unable to load this partner's referred clients.");
  return data.referrals;
}
