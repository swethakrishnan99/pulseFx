import { supabase } from "./supabase";
export async function requestPasswordRecovery(email) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("partner-password-recovery", { method: "POST", body: { email: email.trim() } });
  if (error || !data?.accepted) {
    const body = error?.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(body?.error || "We could not confirm your recovery request. Check your inbox or contact support before trying again.");
  }
}
