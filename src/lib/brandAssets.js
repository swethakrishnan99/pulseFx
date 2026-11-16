import { supabase } from "./supabase";
export async function loadBrandAssets() {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("pulsefx-brand-assets", { method: "POST", body: {} });
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error || "Unable to load PulseFX brand assets.");
  }
  if (!Array.isArray(data?.assets)) throw new Error("Unable to load PulseFX brand assets.");
  return data.assets;
}
