import { supabase } from "./supabase";

async function request(method, body, signal) {
  if (!supabase) throw new Error("PulseFX user administration is not configured.");
  const { data, error } = await supabase.functions.invoke("pulsefx-user-admin", { method, body, signal });
  if (error) {
    let message = "Unable to complete this request. Please try again.";
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === "string") message = response.error;
    }
    throw new Error(message);
  }
  return data;
}
export async function listAdmins(signal) {
  const data = await request("GET", undefined, signal);
  if (!Array.isArray(data?.admins) || !data?.currentUserId) throw new Error("Unable to load PulseFX users.");
  return data;
}
export async function createAdmin(details) {
  const data = await request("POST", { ...details, action: "create" });
  if (!data?.administrator?.id || !data?.link) throw new Error("Unable to verify the administrator invitation. Retry with the same email.");
  return data;
}
export async function manageAdmin(action, details) {
  const data = await request("POST", { ...details, action });
  if (action === "delete") {
    if (!data?.deleted || data.id !== details.id) throw new Error("Administrator deletion could not be confirmed. Refresh and try again.");
  } else if (!data?.administrator?.id || (["invite", "recovery"].includes(action) && !data?.link)) {
    throw new Error("The administrator action could not be confirmed. Refresh and try again.");
  }
  return data;
}
