import { supabase } from "./supabase";

export async function loadAdminDashboard(signal) {
  if (!supabase) throw new Error("The administration dashboard is not configured.");
  const { data, error } = await supabase.functions.invoke("pulsefx-admin-dashboard", { method: "GET", signal });
  if (error) {
    let message = "Unable to load the administration dashboard. Please try again.";
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === "string") message = response.error;
    }
    throw new Error(message);
  }
  if (!Array.isArray(data?.partners) || !Array.isArray(data?.referrals) || !Array.isArray(data?.payouts)) {
    throw new Error("Unable to load the administration dashboard.");
  }
  return data;
}
