import { supabase } from "./supabase";
export async function loadOnePagers() {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("pulsefx-one-pagers", { method: "POST", body: {} });
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error || "Unable to load PulseFX one-pagers.");
  }
  if (!Array.isArray(data?.onePagers)) throw new Error("Unable to load PulseFX one-pagers.");
  return data.onePagers;
}
