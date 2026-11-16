import { supabase } from "./supabase";

export async function createSupportRequest(details) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  // There is intentionally no automatic retry: Airtable may have accepted a timed-out write.
  const { data, error } = await supabase.functions.invoke("partner-support", { method: "POST", body: details });
  if (error) {
    let body;
    if (error.context instanceof Response) body = await error.context.json().catch(() => null);
    const failure = new Error(body?.error || "We could not confirm whether your request was received. Please contact PulseFX by email before submitting it again.");
    failure.uncertain = body?.uncertain ?? !body;
    throw failure;
  }
  if (!data?.request?.supportId) {
    const failure = new Error("We could not confirm whether your request was received. Please contact PulseFX by email before submitting it again.");
    failure.uncertain = true;
    throw failure;
  }
  return data.request;
}
