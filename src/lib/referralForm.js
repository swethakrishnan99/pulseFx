import { supabase } from "./supabase";
export async function loadReferralLink() {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("partner-referral-form", { body: { action: "link" } });
  if (error) {
    const body = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(body?.error || "Unable to load your referral link. Please try again.");
  }
  if (typeof data?.url !== "string" || !/^https?:\/\//.test(data.url)) throw new Error("Unable to load your referral link.");
  return data.url;
}
export async function publicReferralRequest(body, signal) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("The referral form is not configured yet.");
  // Public requests must not inherit any administrator or partner browser session.
  let response;
  try {
    response = await fetch(`${url}/functions/v1/partner-referral-form`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(body.action === "submit" ? "We could not confirm your submission. Please contact PulseFX before submitting again." : "Unable to load the form. Please try again.", { cause: error });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Unable to complete this request.");
  return result;
}
