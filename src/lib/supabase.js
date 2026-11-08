import { createClient } from "@supabase/supabase-js";
import { findPartnerMembership } from "../../supabase/functions/referrals/membership.mjs";

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey, {
      auth: { storageKey: "pulsefx-partner-session" },
    })
  : null;

export async function requirePartner(session) {
  if (!supabase || !session) {
    throw new Error("Please sign in to access the partner portal.");
  }

  // Verify the token with Supabase before resolving access with the caller's RLS policy.
  const { data, error } = await supabase.auth.getUser(session.access_token);
  if (error) throw error;

  const partnerId = await findPartnerMembership({
    projectUrl,
    publishableKey,
    accessToken: session.access_token,
    userId: data.user.id,
  });
  if (!partnerId) {
    throw new Error("Your account does not have partner access. Please contact PulseFX.");
  }
  return { user: data.user, partnerId };
}
