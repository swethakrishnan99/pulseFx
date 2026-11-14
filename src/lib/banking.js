import { supabase } from "./supabase";

async function request(method, body, view, signal) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke(`partner-banking${view ? `?view=${view}` : ""}`, { method, body, signal });
  if (error) {
    let message = method === "POST" ? "Unable to confirm your details were saved. Refresh banking details before trying again." : "Unable to load banking details. Please try again.";
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === "string") message = response.error;
    }
    throw new Error(message);
  }
  return data;
}
export async function loadBanking(signal) {
  const data = await request("GET", undefined, undefined, signal);
  if (!Array.isArray(data?.accounts)) throw new Error("Unable to load banking details.");
  return data;
}
export async function submitBanking(details) {
  const data = await request("POST", details);
  if (!data?.account?.id) throw new Error("Unable to confirm your details were saved. Refresh before trying again.");
  return data.account;
}
export async function loadPayouts(signal) {
  const data = await request("GET", undefined, "payouts", signal);
  if (!Array.isArray(data?.payouts)) throw new Error("Unable to load payouts.");
  return data.payouts;
}

export async function loadBankingReviews(signal) {
  const data = await request("GET", undefined, "review", signal);
  if (!Array.isArray(data?.submissions)) throw new Error("Unable to load bank submissions.");
  return data.submissions;
}
export async function reviewBanking(details) {
  const data = await request("POST", details, "review");
  if (!data?.reviewed) throw new Error("Unable to confirm the review. Refresh before trying again.");
}
