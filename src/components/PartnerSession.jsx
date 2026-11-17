import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase, requirePartner } from "../lib/supabase";
import PartnerPortal from "./PartnerPortal";

export default function PartnerSession({ onExit }) {
  const [access, setAccess] = useState({ loading: true });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const location = useLocation();

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let version = 0;
    let timer;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++version;
      clearTimeout(timer);
      // Auth callbacks finish before starting another Supabase request.
      timer = setTimeout(async () => {
        if (!active) return;
        if (!session) {
          // No session: the router sends the visitor to the partner sign-in page.
          if (current === version) setAccess({ loading: false, signedOut: true });
          return;
        }
        setAccess((previous) => session?.user?.id && previous.user?.id === session.user.id
          ? previous
          : { loading: true });
        try {
          const partner = await requirePartner(session);
          if (active && current === version) setAccess({ loading: false, ...partner });
        } catch {
          if (active && current === version) {
            setAccess({ loading: false, error: "Partner access could not be verified. Please sign in again." });
          }
        }
      }, 0);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setSignOutError("Unable to sign out. Please try again.");
      setSigningOut(false);
      return;
    }
    onExit();
  }

  if (supabase && access.signedOut) {
    return signingOut ? null : <Navigate to="/partner/sign-in" replace state={{ from: location.pathname }} />;
  }

  if (!supabase || access.loading || !access.user) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
          <p role="status" className="text-sm text-gray-700">
            {!supabase ? "Partner sign-in is not configured." : access.loading ? "Verifying partner access…" : access.error}
          </p>
          {(!supabase || !access.loading) && (
            <button type="button" onClick={onExit} className="mt-4 text-sm font-medium text-accent">
              Return to sign in
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <PartnerPortal
      onExit={signOut}
      user={access.user}
      isAdmin={access.isAdmin}
      basePath="/partner"
      signingOut={signingOut}
      signOutError={signOutError}
    />
  );
}