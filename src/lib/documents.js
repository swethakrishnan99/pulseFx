import { supabase } from "./supabase";
export async function documentsRequest(body) {
  if (!supabase) throw new Error("Administrator sign-in is not configured.");
  const { data, error } = await supabase.functions.invoke("pulsefx-documents", { body });
  if (error) {
    const details = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    const failure = new Error(details?.error || "Unable to confirm the request. Refresh Documents before trying again.");
    failure.uncertain = details?.uncertain ?? body.action !== "load";
    throw failure;
  }
  return data;
}
export const documentSnapshot = document => ({ name: document.name, filename: document.file?.name || "", fileId: document.file?.id || null, visible: document.visible, replacedAt: document.replaced.at });
