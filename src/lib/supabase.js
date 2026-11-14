import { createClient } from "@supabase/supabase-js";
import { findPartnerMembership } from "../../supabase/functions/referrals/membership.mjs";

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey, {
      // Keep sessions from the previous project separate after a migration.
      auth: { storageKey: `pulsefx-partner-session:${new URL(projectUrl).hostname}` },
    })
  : null;

export function createActivationClient() {
  // Invitations opened in an admin's browser must not replace their session.
  return projectUrl && publishableKey ? createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "pulsefx-partner-activation" },
  }) : null;
}

export async function requirePartner(session) {
  if (!supabase || !session) {
    throw new Error("Please sign in to access the partner portal.");
  }

  // Verify the token with Supabase before resolving access with the caller's RLS policy.
  const { data, error } = await supabase.auth.getUser(session.access_token);
  if (error) throw error;

  // Only trusted server-managed app metadata can grant administration access.
  // user_metadata and email matching must never grant this permission.
  if (data.user.app_metadata?.role === "partner_admin") {
    return { user: data.user, partnerId: null, isAdmin: true };
  }

  const partnerId = await findPartnerMembership({
    projectUrl,
    publishableKey,
    accessToken: session.access_token,
    userId: data.user.id,
  });
  if (!partnerId) {
    throw new Error("Your account does not have partner access. Please contact PulseFX.");
  }
  return { user: data.user, partnerId, isAdmin: false };
}
