import { supabase } from "./supabase";
async function request(body) {
  if (!supabase) throw new Error("Partner sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("partner-brand-kit", { body });
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error || "Unable to load or save the Brand kit. Reload to check the current version.");
  }
  return data;
}
export function encodeBrandFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Unable to read this file."));
    reader.readAsDataURL(file);
  });
}

export async function brandKitRequest(body) {
  const data = await request(body);
  if (!data?.kit) throw new Error("Unable to load the Brand kit.");
  return data.kit;
}
